import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/mvp/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import type { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { configureApp } from '../../src/core/http';
import { parseConfig } from '../../src/core/config';

async function main(): Promise<void> {
  if (
    process.env.MVP_DISPOSABLE_TEST !== '1' ||
    !new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test')
  ) {
    throw new Error(
      'Live tests require an explicitly disposable _test database.',
    );
  }
  const mailDir = await mkdtemp(join(tmpdir(), 'ppets-auth-check-'));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    CLIENT_BASEURL: 'http://localhost:3002',
    SESSION_SECRET: randomBytes(32).toString('hex'),
    EMAIL_STUB_DIR: mailDir,
    AUTH_RATE_LIMIT: '1000',
    API_RATE_LIMIT: '2000',
  });
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  configureApp(app, parseConfig(process.env));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const email = 'member+' + randomUUID() + '@example.test';
  const preregistrationPassword = randomBytes(20).toString('hex');
  const password = randomBytes(20).toString('hex');
  const nextPassword = randomBytes(20).toString('hex');
  async function call(
    route: string,
    body?: object,
    cookie?: string,
  ): Promise<Response> {
    return fetch(base + '/api/auth/' + route, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function token(purpose: string, excluded?: string): Promise<string> {
    for (const file of await readdir(mailDir)) {
      const mail = JSON.parse(await readFile(join(mailDir, file), 'utf8')) as {
        to: string;
        purpose: string;
        url: string;
      };
      if (mail.to === email && mail.purpose === purpose) {
        const url = new URL(mail.url);
        const value =
          url.searchParams.get(
            purpose === 'VERIFY_EMAIL' ? 'verify' : 'reset',
          ) ?? '';
        if (value !== excluded) return value;
      }
    }
    throw new Error('Stub message missing');
  }
  try {
    assert.equal((await call('session')).status, 401);
    assert.equal(
      (
        await call('signup', {
          name: 'MVP Test Member',
          email,
          password,
          role: 'admin',
        })
      ).status,
      400,
    );
    const preregistration = await call('signup', {
      name: 'Earlier Unverified Signup',
      email,
      password: preregistrationPassword,
    });
    assert.equal(preregistration.status, 202);
    const staleVerification = await token('VERIFY_EMAIL');
    const signup = await call('signup', {
      name: 'MVP Test Member',
      email,
      password,
    });
    assert.ok([200, 202].includes(signup.status));
    assert.equal((await call('login', { email, password })).status, 401);
    assert.equal(
      (await call('verify-email', { token: staleVerification })).status,
      400,
    );
    const verify = await token('VERIFY_EMAIL', staleVerification);
    assert.match(verify, /^[a-f0-9]{64}$/);
    assert.equal((await call('verify-email', { token: verify })).status, 200);
    assert.equal((await call('verify-email', { token: verify })).status, 400);
    assert.equal(
      (await call('login', { email, password: preregistrationPassword }))
        .status,
      401,
    );
    assert.equal(
      (
        await call('signup', {
          name: 'Later Signup',
          email,
          password: preregistrationPassword,
        })
      ).status,
      202,
    );
    const login = await call('login', { email, password });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('ppets_session='));
    const loggedIn = (await login.json()) as {
      user: { role: string; name: string };
    };
    assert.equal(loggedIn.user.role, 'member');
    assert.equal(loggedIn.user.name, 'MVP Test Member');
    assert.equal((await call('session', undefined, cookie)).status, 200);
    assert.equal((await call('forgot-password', { email })).status, 200);
    const reset = await token('RESET_PASSWORD');
    assert.equal(
      (await call('reset-password', { token: reset, password: nextPassword }))
        .status,
      200,
    );
    assert.equal(
      (await call('reset-password', { token: reset, password: nextPassword }))
        .status,
      400,
    );
    assert.equal((await call('session', undefined, cookie)).status, 401);
    assert.equal((await call('login', { email, password })).status, 401);
    const relogin = await call('login', { email, password: nextPassword });
    assert.equal(relogin.status, 200);
    const nextCookie = relogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(nextCookie);
    assert.equal((await call('logout', {}, nextCookie)).status, 200);
    assert.equal((await call('session', undefined, nextCookie)).status, 401);
    // Pause a real-database login after its credential snapshot, then reset.
    const db = app.get(DatabaseService);
    const account = await db.users.findUniqueOrThrow({ where: { email } });
    let observed!: () => void;
    let resume!: () => void;
    const observedSnapshot = new Promise<void>((resolve) => {
      observed = resolve;
    });
    const continueLogin = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const racingDatabase = {
      users: {
        findUnique: async (args: Prisma.usersFindUniqueArgs) => {
          const snapshot = await db.users.findUnique(args);
          observed();
          await continueLogin;
          return snapshot;
        },
      },
      $transaction: db.$transaction.bind(db),
    } as unknown as DatabaseService;
    const racingAuth = new AuthService(
      racingDatabase,
      parseConfig(process.env),
      { send: async () => undefined },
    );
    const pendingLogin = racingAuth.login({ email, password: nextPassword });
    await observedSnapshot;
    const raceToken = randomBytes(32).toString('hex');
    await db.authToken.create({
      data: {
        userId: account.id,
        tokenHash: createHmac('sha256', process.env.SESSION_SECRET!)
          .update(raceToken)
          .digest('hex'),
        purpose: 'RESET_PASSWORD',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const finalPassword = randomBytes(20).toString('hex');
    try {
      assert.equal(
        (
          await call('reset-password', {
            token: raceToken,
            password: finalPassword,
          })
        ).status,
        200,
      );
    } finally {
      resume();
    }
    await assert.rejects(pendingLogin, { code: 'INVALID_CREDENTIALS' });
    assert.equal(
      await db.authSession.count({ where: { userId: account.id } }),
      0,
    );
    const forbiddenOrigin = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://attacker.invalid',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password: nextPassword }),
    });
    assert.equal(forbiddenOrigin.status, 403);
    console.log(
      JSON.stringify({
        event: 'live_auth_passed',
        checks: [
          'signup',
          'pending signup replacement rejects stale verification and earlier password',
          'verified signup preserves credentials',
          'verification single use',
          'member role',
          'sessions',
          'password reset single use',
          'session revocation',
          'logout',
          'origin rejection',
        ],
      }),
    );
  } finally {
    await app.close();
    await rm(mailDir, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Live auth check failed',
  );
  process.exitCode = 1;
});
