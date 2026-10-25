import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/core/http';
import { parseConfig } from '../../src/core/config';

type Asset = { id: number; availableQuantity: number };
type RequestRow = { id: string; status: string };
type Summary = {
  assetTypes: number;
  availableUnits: number;
  pendingRequests: number;
  assignedUnits: number;
  returnedRequests: number;
};
type Paged<T> = { items: T[]; total: number; page: number; limit: number };
async function main(): Promise<void> {
  if (
    process.env.MVP_DISPOSABLE_TEST !== '1' ||
    !new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test')
  )
    throw new Error(
      'Live flow requires an explicitly disposable _test database.',
    );
  const mailDir = await mkdtemp(join(tmpdir(), 'ppets-flow-check-'));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    CLIENT_BASEURL: 'http://localhost:3002',
    SESSION_SECRET: randomBytes(32).toString('hex'),
    EMAIL_STUB_DIR: mailDir,
    AUTH_RATE_LIMIT: '2000',
    API_RATE_LIMIT: '2000',
  });
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  configureApp(app, parseConfig(process.env));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function call(
    path: string,
    body?: object,
    cookie?: string,
  ): Promise<Response> {
    return fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function login(email: string, password: string): Promise<string> {
    const response = await call('/api/auth/login', { email, password });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    return cookie;
  }
  async function member(): Promise<string> {
    const email = 'flow+' + randomUUID() + '@example.test';
    const password = randomBytes(20).toString('hex');
    assert.equal(
      (
        await call('/api/auth/signup', {
          name: 'Flow Test Employee',
          email,
          password,
        })
      ).status,
      202,
    );
    let token = '';
    for (const file of await readdir(mailDir)) {
      const mail = JSON.parse(await readFile(join(mailDir, file), 'utf8')) as {
        to: string;
        url: string;
      };
      if (mail.to === email)
        token = new URL(mail.url).searchParams.get('verify') ?? '';
    }
    assert.ok(token);
    assert.equal((await call('/api/auth/verify-email', { token })).status, 200);
    return login(email, password);
  }
  async function assets(cookie: string): Promise<Paged<Asset>> {
    const response = await call('/api/assets?limit=50', undefined, cookie);
    assert.equal(response.status, 200);
    return response.json() as Promise<Paged<Asset>>;
  }
  async function create(
    cookie: string,
    assetId: number,
    quantity: number,
  ): Promise<RequestRow> {
    const response = await call(
      '/api/requests',
      {
        assetId,
        quantity,
        reason: 'Temporary assignment for the MVP acceptance check',
      },
      cookie,
    );
    assert.equal(response.status, 201);
    return ((await response.json()) as { request: RequestRow }).request;
  }
  async function summary(cookie: string): Promise<Summary> {
    const response = await call('/api/summary', undefined, cookie);
    assert.equal(response.status, 200);
    return response.json() as Promise<Summary>;
  }
  try {
    const unauthenticated = await call('/api/assets');
    assert.equal(unauthenticated.status, 401);
    const err = (await unauthenticated.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    assert.equal(
      err.error.requestId,
      unauthenticated.headers.get('x-request-id'),
    );
    assert.equal(err.error.code, 'UNAUTHENTICATED');
    const first = await member();
    const second = await member();
    const admin = await login(
      process.env.SEED_ADMIN_EMAIL ?? '',
      process.env.SEED_ADMIN_PASSWORD ?? '',
    );
    const list = await assets(first);
    const asset = list.items.find((x) => x.availableQuantity > 0);
    assert.ok(asset);
    const initialSummary = await summary(first);
    const otherSummary = await summary(second);
    const cancellable = await create(first, asset.id, 1);
    assert.equal(
      (await summary(first)).pendingRequests,
      initialSummary.pendingRequests + 1,
    );
    assert.equal(
      (await summary(second)).pendingRequests,
      otherSummary.pendingRequests,
    );
    assert.equal(
      (await call('/api/requests/' + cancellable.id + '/cancel', {}, second))
        .status,
      403,
    );
    assert.equal(
      (await call('/api/requests/' + cancellable.id + '/cancel', {}, admin))
        .status,
      403,
    );
    assert.equal(
      (await call('/api/requests/' + cancellable.id + '/cancel', {}, first))
        .status,
      200,
    );
    assert.equal(
      (await call('/api/requests/' + cancellable.id + '/cancel', {}, first))
        .status,
      409,
    );
    assert.equal(
      (await call('/api/requests/' + cancellable.id + '/approve', {}, admin))
        .status,
      409,
    );
    const rejectable = await create(first, asset.id, 1);
    assert.equal(
      (await call('/api/requests/' + rejectable.id + '/reject', {}, first))
        .status,
      403,
    );
    assert.equal(
      (await call('/api/requests/' + rejectable.id + '/reject', {}, admin))
        .status,
      200,
    );
    assert.equal(
      (await call('/api/requests/' + rejectable.id + '/reject', {}, admin))
        .status,
      409,
    );
    assert.equal(
      (await call('/api/requests/' + rejectable.id + '/cancel', {}, first))
        .status,
      409,
    );
    assert.deepEqual(await summary(first), initialSummary);
    assert.equal(
      (await assets(first)).items.find((x) => x.id === asset.id)
        ?.availableQuantity,
      asset.availableQuantity,
    );
    assert.equal(
      (await call('/api/assets?limit=0', undefined, first)).status,
      400,
    );
    assert.equal(
      (
        await call(
          '/api/requests',
          {
            assetId: asset.id,
            quantity: 1.5,
            reason: 'Invalid fractional quantity',
          },
          first,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          '/api/requests',
          {
            assetId: asset.id,
            quantity: 1,
            reason: 'Identity override',
            employeeId: 99,
          },
          first,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          '/api/requests',
          { assetId: asset.id, quantity: 1, reason: 'Admin cannot request' },
          admin,
        )
      ).status,
      403,
    );
    const request = await create(first, asset.id, 1);
    assert.equal(
      (await call('/api/requests/' + request.id + '/approve', {}, first))
        .status,
      403,
    );
    assert.ok(
      [403, 404].includes(
        (await call('/api/requests/' + request.id + '/return', {}, second))
          .status,
      ),
    );
    assert.equal(
      (await call('/api/requests/' + request.id + '/approve', {}, admin))
        .status,
      200,
    );
    assert.equal(
      (await assets(first)).items.find((x) => x.id === asset.id)
        ?.availableQuantity,
      asset.availableQuantity - 1,
    );
    assert.equal(
      (await call('/api/requests/' + request.id + '/approve', {}, admin))
        .status,
      409,
    );
    const filtered = await call(
      '/api/requests?status=APPROVED&limit=1',
      undefined,
      first,
    );
    assert.equal(filtered.status, 200);
    const approved = (await filtered.json()) as Paged<RequestRow>;
    assert.ok(approved.items.every((x) => x.status === 'APPROVED'));
    assert.equal(approved.limit, 1);
    assert.equal(
      (await call('/api/requests/' + request.id + '/return', {}, first)).status,
      200,
    );
    assert.equal(
      (await call('/api/requests/' + request.id + '/return', {}, first)).status,
      409,
    );
    assert.equal(
      (await assets(first)).items.find((x) => x.id === asset.id)
        ?.availableQuantity,
      asset.availableQuantity,
    );
    // Competing approvals must never over-allocate the same stock.
    const a = await create(first, asset.id, asset.availableQuantity);
    const b = await create(second, asset.id, asset.availableQuantity);
    const approvals = await Promise.all([
      call('/api/requests/' + a.id + '/approve', {}, admin),
      call('/api/requests/' + b.id + '/approve', {}, admin),
    ]);
    assert.deepEqual(approvals.map((x) => x.status).sort(), [200, 409]);
    assert.equal(
      (await assets(first)).items.find((x) => x.id === asset.id)
        ?.availableQuantity,
      0,
    );
    const winner =
      approvals[0].status === 200
        ? { request: a, cookie: first }
        : { request: b, cookie: second };
    const returns = await Promise.all([
      call('/api/requests/' + winner.request.id + '/return', {}, winner.cookie),
      call('/api/requests/' + winner.request.id + '/return', {}, winner.cookie),
    ]);
    assert.deepEqual(returns.map((x) => x.status).sort(), [200, 409]);
    assert.equal(
      (await assets(first)).items.find((x) => x.id === asset.id)
        ?.availableQuantity,
      asset.availableQuantity,
    );
    console.log(
      JSON.stringify({
        event: 'live_flow_passed',
        checks: [
          'member/admin authorization',
          'strict validation',
          'pagination/filtering',
          'request/approve/return',
          'reject/cancel without stock changes',
          'scoped aggregate summary',
          'ownership',
          'duplicate approval/return',
          'competing stock approvals',
          'concurrent returns',
        ],
      }),
    );
  } finally {
    await app.close();
    await rm(mailDir, { recursive: true, force: true });
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Live flow failed');
  process.exitCode = 1;
});
