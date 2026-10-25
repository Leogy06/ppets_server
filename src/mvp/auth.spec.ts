import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';
import { AuthService } from './auth.service';
import type { DatabaseService } from '../database/database.service';
import type { AppConfig } from '../core/config';
import type { MailSender } from './mail';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn().mockResolvedValue(true),
}));
const config = {
  SESSION_SECRET: 'test-secret-that-is-at-least-32-chars',
  SESSION_TTL_HOURS: 24,
  CLIENT_BASEURL: 'http://localhost:3002',
  NODE_ENV: 'test',
} as AppConfig;
const raw = 'a'.repeat(64);
const digest = (token: string) =>
  createHmac('sha256', config.SESSION_SECRET).update(token).digest('hex');
const user = {
  id: 1,
  email: 'member@example.test',
  password: 'hash',
  role: 2,
  emp_id: 12,
  is_active: 1,
  emailVerifiedAt: new Date(),
  employee: {
    ID: 12,
    FIRSTNAME: 'Test',
    LASTNAME: 'Member',
    DELETED: 0,
    CURRENT_DPT_ID: 2,
    DEPARTMENT_ID: 1,
  },
};
function fixture() {
  const db = {
    users: {
      findUnique: jest.fn().mockResolvedValue(user),
      create: jest.fn().mockResolvedValue({ ...user, emailVerifiedAt: null }),
      update: jest.fn().mockResolvedValue(user),
    },
    authSession: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest
        .fn()
        .mockResolvedValue({ expiresAt: new Date(Date.now() + 100000), user }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({
        userId: 1,
        purpose: 'VERIFY_EMAIL',
        expiresAt: new Date(Date.now() + 100000),
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([user]),
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    db as unknown as DatabaseService,
    config,
    mail as MailSender,
  );
  return { db, mail, service };
}
describe('real authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(bcrypt.hash)
      .mockReset()
      .mockResolvedValue('hash' as never);
    jest
      .mocked(bcrypt.compare)
      .mockReset()
      .mockResolvedValue(true as never);
  });
  it('signs up an unverified member without accepting a role and sends only a private verification link', async () => {
    const { db, mail, service } = fixture();
    db.users.findUnique.mockResolvedValueOnce(null);
    await service.signup({
      name: 'Test Member',
      email: ' Member@Example.Test ',
      password: 'long-test-password',
    });
    expect(db.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 2,
          emailVerifiedAt: null,
          email: user.email,
        }),
      }),
    );
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'VERIFY_EMAIL',
        url: expect.stringMatching(
          /^http:\/\/localhost:3002\/mvp\/\?verify=[a-f0-9]{64}$/,
        ),
      }),
    );
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  it('returns the same signup message for an existing verified account without changing it', async () => {
    const { db, mail, service } = fixture();
    const result = await service.signup({
      name: 'Changed Name',
      email: user.email,
      password: 'new-test-password',
    });
    expect(result).toEqual({ message: expect.any(String) });
    expect(db.users.update).not.toHaveBeenCalled();
    expect(db.users.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('replaces an unverified signup password and invalidates the older verification intent', async () => {
    const { db, mail, service } = fixture();
    db.users.findUnique.mockResolvedValue({
      ...user,
      emailVerifiedAt: null,
    });
    await service.signup({
      name: 'Other Name',
      email: user.email,
      password: 'different-password',
    });
    expect(db.users.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        password: 'hash',
        employee: { update: { FIRSTNAME: 'Other', LASTNAME: 'Name' } },
      },
    });
    expect(db.authToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, purpose: 'VERIFY_EMAIL' },
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
  it('activates only the latest signup credentials after an attacker preregisters the email', async () => {
    const { db, mail, service } = fixture();
    let account = {
      ...user,
      password: 'attacker-hash',
      emailVerifiedAt: null as Date | null,
    };
    const tokens = new Map<
      string,
      { userId: number; purpose: string; expiresAt: Date }
    >();
    db.users.findUnique.mockImplementation(async () => account);
    db.$queryRaw.mockImplementation(async () => [account]);
    db.users.update.mockImplementation(
      async ({
        data,
      }: {
        data: {
          password?: string;
          emailVerifiedAt?: Date;
          employee?: { update: { FIRSTNAME: string; LASTNAME: string } };
        };
      }) => {
        const { employee, ...fields } = data;
        account = {
          ...account,
          ...fields,
          employee: { ...account.employee, ...employee?.update },
        };
        return account;
      },
    );
    db.authToken.create.mockImplementation(
      async ({
        data,
      }: {
        data: {
          tokenHash: string;
          userId: number;
          purpose: string;
          expiresAt: Date;
        };
      }) => {
        tokens.set(data.tokenHash, data);
        return data;
      },
    );
    db.authToken.findUnique.mockImplementation(
      async ({ where }: { where: { tokenHash: string } }) =>
        tokens.get(where.tokenHash) ?? null,
    );
    db.authToken.deleteMany.mockImplementation(
      async ({
        where,
      }: {
        where: { tokenHash?: string; userId?: number; purpose?: string };
      }) => {
        let count = 0;
        for (const [key, stored] of tokens) {
          if (
            (!where.tokenHash || key === where.tokenHash) &&
            (!where.userId || stored.userId === where.userId) &&
            (!where.purpose || stored.purpose === where.purpose)
          ) {
            tokens.delete(key);
            count++;
          }
        }
        return { count };
      },
    );
    jest
      .mocked(bcrypt.hash)
      .mockResolvedValueOnce('attacker-hash' as never)
      .mockResolvedValueOnce('victim-hash' as never);
    await service.signup({
      name: 'Attacker Name',
      email: user.email,
      password: 'attacker-password',
    });
    const oldToken = new URL(
      (mail.send.mock.calls[0] as [{ url: string }])[0].url,
    ).searchParams.get('verify')!;
    await service.signup({
      name: 'Actual Member',
      email: user.email,
      password: 'victim-password',
    });
    const latestToken = new URL(
      (mail.send.mock.calls[1] as [{ url: string }])[0].url,
    ).searchParams.get('verify')!;
    await expect(service.verify(oldToken)).rejects.toMatchObject({
      status: 400,
    });
    expect(account.emailVerifiedAt).toBeNull();
    await service.verify(latestToken);
    jest
      .mocked(bcrypt.compare)
      .mockResolvedValueOnce(false as never)
      .mockResolvedValueOnce(true as never);
    await expect(
      service.login({ email: user.email, password: 'attacker-password' }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.login({ email: user.email, password: 'victim-password' }),
    ).resolves.toMatchObject({
      user: { email: user.email, name: 'Actual Member' },
    });
    expect(account.password).toBe('victim-hash');
    expect(bcrypt.compare).toHaveBeenNthCalledWith(
      1,
      'attacker-password',
      'victim-hash',
    );
    expect(bcrypt.compare).toHaveBeenNthCalledWith(
      2,
      'victim-password',
      'victim-hash',
    );
  });
  it('rechecks verification after acquiring the signup row lock', async () => {
    const { db, mail, service } = fixture();
    db.users.findUnique
      .mockResolvedValueOnce({ ...user, emailVerifiedAt: null })
      .mockResolvedValueOnce(user);
    await service.signup({
      name: 'Other Name',
      email: user.email,
      password: 'different-password',
    });
    expect(db.users.update).not.toHaveBeenCalled();
    expect(db.authToken.deleteMany).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('recovers a concurrent first-signup email collision using the locked pending account', async () => {
    const { db, mail, service } = fixture();
    const pending = { ...user, emailVerifiedAt: null };
    db.users.findUnique.mockResolvedValueOnce(null).mockResolvedValue(pending);
    db.users.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique email'), { code: 'P2002' }),
    );
    await expect(
      service.signup({
        name: 'Member',
        email: user.email,
        password: 'victim-password',
      }),
    ).resolves.toEqual({ message: expect.any(String) });
    expect(db.users.create).toHaveBeenCalledTimes(1);
    expect(db.users.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        password: 'hash',
        employee: { update: { FIRSTNAME: 'Member', LASTNAME: '' } },
      },
    });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
  it('does not mail a verification link before the signup transaction commits', async () => {
    const { db, mail, service } = fixture();
    db.users.findUnique.mockResolvedValue({ ...user, emailVerifiedAt: null });
    db.$transaction.mockImplementationOnce(
      async (run: (tx: typeof db) => Promise<unknown>) => {
        await run(db);
        throw new Error('Commit failed');
      },
    );
    await expect(
      service.signup({
        name: 'Member',
        email: user.email,
        password: 'victim-password',
      }),
    ).rejects.toThrow('Commit failed');
    expect(mail.send).not.toHaveBeenCalled();
  });
  it.each([
    { emailVerifiedAt: new Date() },
    { is_active: 0 },
    { role: 1 },
    { employee: { ...user.employee, DELETED: 1 } },
  ])(
    'does not replace signup credentials for an ineligible account',
    async (changes) => {
      const { db, mail, service } = fixture();
      db.users.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
        ...changes,
      });
      await service.signup({
        name: 'Other Name',
        email: user.email,
        password: 'different-password',
      });
      expect(db.users.update).not.toHaveBeenCalled();
      expect(db.authToken.create).not.toHaveBeenCalled();
      expect(mail.send).not.toHaveBeenCalled();
    },
  );
  it('stores only a keyed token hash and rotates the current session on login', async () => {
    const { db, service } = fixture();
    const result = await service.login(
      { email: user.email, password: 'long-test-password' },
      raw,
    );
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.user).not.toHaveProperty('password');
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: digest(raw) },
    });
    expect(db.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: digest(result.token),
        userId: 1,
      }),
    });
  });
  it.each([
    { emailVerifiedAt: null },
    { is_active: 0 },
    { role: 99 },
    { employee: { ...user.employee, DELETED: 1 } },
  ])(
    'rejects invalid account state on login and session use',
    async (changes) => {
      const { db, service } = fixture();
      const invalid = { ...user, ...changes };
      db.users.findUnique.mockResolvedValueOnce(invalid);
      db.authSession.findUnique.mockResolvedValueOnce({
        user: invalid,
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(
        service.login({ email: user.email, password: 'long-test-password' }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(service.authenticate(raw)).resolves.toBeNull();
      expect(db.authSession.create).not.toHaveBeenCalled();
    },
  );
  it('does not trust missing or expired sessions', async () => {
    const { db, service } = fixture();
    await expect(service.authenticate('malformed')).resolves.toBeNull();
    expect(db.authSession.findUnique).not.toHaveBeenCalled();
    db.authSession.findUnique.mockResolvedValueOnce({
      user,
      expiresAt: new Date(0),
    });
    await expect(service.authenticate(raw)).resolves.toBeNull();
  });
  it('consumes verification once without issuing a session', async () => {
    const { db, service } = fixture();
    await service.verify(raw);
    expect(db.authToken.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tokenHash: digest(raw),
        purpose: 'VERIFY_EMAIL',
      }),
    });
    expect(db.users.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(db.authSession.create).not.toHaveBeenCalled();
    db.authToken.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.verify(raw)).rejects.toMatchObject({ status: 400 });
  });
  it('atomically resets password and revokes sessions and reset tokens', async () => {
    const { db, service } = fixture();
    db.authToken.findUnique.mockResolvedValueOnce({
      userId: 1,
      purpose: 'RESET_PASSWORD',
      expiresAt: new Date(Date.now() + 100000),
    });
    await service.resetPassword(raw, 'new-long-password');
    expect(bcrypt.hash).toHaveBeenCalledWith('new-long-password', 12);
    expect(db.users.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password: 'hash' },
    });
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1 },
    });
    expect(db.authToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 1, purpose: 'RESET_PASSWORD' },
    });
  });
  it('rejects expired or wrong-purpose tokens without changing users', async () => {
    const { db, service } = fixture();
    db.authToken.findUnique.mockResolvedValueOnce({
      userId: 1,
      purpose: 'VERIFY_EMAIL',
      expiresAt: new Date(0),
    });
    await expect(service.verify(raw)).rejects.toMatchObject({ status: 400 });
    await expect(
      service.resetPassword(raw, 'new-long-password'),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.users.update).not.toHaveBeenCalled();
  });
  it('returns generic forgotten-password responses without exposing account existence', async () => {
    const { db, mail, service } = fixture();
    const existing = await service.forgotPassword(user.email);
    db.users.findUnique.mockResolvedValueOnce(null);
    expect(await service.forgotPassword('absent@example.test')).toEqual(
      existing,
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
  it('keeps mail failure responses generic and logs only a private event and purpose', async () => {
    const { db, mail, service } = fixture();
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const baseline = await service.forgotPassword(user.email);
      mail.send.mockRejectedValueOnce(
        new Error('private token url and transport details'),
      );
      expect(await service.forgotPassword(user.email)).toEqual(baseline);
      db.users.findUnique.mockResolvedValueOnce(null);
      expect(await service.forgotPassword('absent@example.test')).toEqual(
        baseline,
      );
      db.users.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: null,
      });
      mail.send.mockRejectedValueOnce(new Error('private signup token'));
      await expect(
        service.signup({
          name: 'Test Member',
          email: user.email,
          password: 'long-test-password',
        }),
      ).resolves.toEqual({
        message: 'If this account needs verification, an email has been sent.',
      });
      expect(log.mock.calls).toEqual([
        [
          JSON.stringify({
            level: 'error',
            event: 'mail_delivery_failed',
            purpose: 'RESET_PASSWORD',
          }),
        ],
        [
          JSON.stringify({
            level: 'error',
            event: 'mail_delivery_failed',
            purpose: 'VERIFY_EMAIL',
          }),
        ],
      ]);
    } finally {
      log.mockRestore();
    }
  });
  it('rejects an old-password login if reset commits after bcrypt but before the session transaction', async () => {
    const { db, service } = fixture();
    let persistReset: (() => void) | undefined;
    const checked = new Promise<void>((resolve) => {
      persistReset = resolve;
    });
    let resumeCompare: ((value: boolean) => void) | undefined;
    jest.mocked(bcrypt.compare).mockImplementationOnce(() => {
      persistReset!();
      return new Promise<boolean>((resolve) => {
        resumeCompare = resolve;
      });
    });
    const pending = service.login({
      email: user.email,
      password: 'old-long-password',
    });
    await checked;
    db.$queryRaw.mockResolvedValueOnce([
      { ...user, password: 'reset-password-hash' },
    ]);
    resumeCompare!(true);
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.create).not.toHaveBeenCalled();
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [sql, id] = db.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      number,
    ];
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect(id).toBe(user.id);
  });
  it('rejects passwords exceeding bcrypt byte limit before hashing or comparing', async () => {
    const { service } = fixture();
    await expect(
      service.login({ email: user.email, password: '\u00e9'.repeat(40) }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.resetPassword(raw, '\u00e9'.repeat(40)),
    ).rejects.toMatchObject({ status: 400 });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
  it('uses a bcrypt dummy comparison for absent users and rejects bad credentials', async () => {
    const { db, service } = fixture();
    db.users.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.login({
        email: 'absent@example.test',
        password: 'long-test-password',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'long-test-password',
      expect.stringMatching(/^\$2b\$12\$/),
    );
    jest.mocked(bcrypt.compare).mockImplementationOnce(async () => false);
    await expect(
      service.login({ email: user.email, password: 'wrong-long-password' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  it('returns fresh safe session identity and revokes exactly the hashed session on logout', async () => {
    const { db, service } = fixture();
    await expect(service.authenticate(raw)).resolves.toEqual({
      id: 1,
      employeeId: 12,
      departmentId: 2,
      email: user.email,
      name: 'Test Member',
      role: 'member',
    });
    await service.logout(raw);
    expect(db.authSession.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: digest(raw) },
    });
  });
  it('rejects a racing reset consumer without updating the password or sessions', async () => {
    const { db, service } = fixture();
    db.authToken.findUnique.mockResolvedValueOnce({
      userId: 1,
      purpose: 'RESET_PASSWORD',
      expiresAt: new Date(Date.now() + 100000),
    });
    db.authToken.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.resetPassword(raw, 'new-long-password'),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.users.update).not.toHaveBeenCalled();
    expect(db.authSession.deleteMany).not.toHaveBeenCalled();
  });
});
