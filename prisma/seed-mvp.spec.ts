import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedMvp } from './seed-mvp';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));
const input = {
  email: 'admin@example.test',
  password: 'fictional-test-password',
};
function database(existing: { role: number; emp_id: number } | null = null) {
  const tx = {
    users: {
      findUnique: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn().mockResolvedValue({ role: 1, emp_id: 42 }),
    },
    items: {
      upsert: jest.fn().mockImplementation(async () => ({})),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (run: (client: typeof tx) => Promise<void>) =>
      run(tx),
    ),
  };
  return { tx, prisma, client: prisma as unknown as PrismaClient };
}
describe('MVP bootstrap seed', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([
    { email: '', password: input.password },
    { email: 'invalid', password: input.password },
    { email: input.email, password: 'too-short' },
    { email: input.email, password: 'x'.repeat(73) },
  ])(
    'rejects invalid configuration before database access or hashing',
    async (invalid) => {
      const db = database();
      await expect(seedMvp(db.client, invalid)).rejects.toThrow();
      expect(db.prisma.$transaction).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    },
  );
  it('does not elevate an existing member', async () => {
    const db = database({ role: 2, emp_id: 42 });
    await expect(seedMvp(db.client, input)).rejects.toThrow(/existing.*admin/i);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(db.tx.users.upsert).not.toHaveBeenCalled();
    expect(db.tx.items.upsert).not.toHaveBeenCalled();
  });
  it('creates a verified admin and employee, hashing at cost 12', async () => {
    const db = database();
    await seedMvp(db.client, { ...input, email: ' Admin@Example.Test ' });
    expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);
    expect(db.tx.users.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: input.email },
        update: {},
        create: expect.objectContaining({
          email: input.email,
          role: 1,
          password: 'hashed',
          emailVerifiedAt: expect.any(Date),
          employee: {
            create: expect.objectContaining({
              ID_NUMBER: 2026001,
              FIRSTNAME: 'PPETS',
              LASTNAME: 'Administrator',
            }),
          },
        }),
      }),
    );
    expect(db.tx.items.upsert).toHaveBeenCalledTimes(3);
  });
  it('preserves existing admin password and asset stock on rerun', async () => {
    const db = database({ role: 1, emp_id: 42 });
    await seedMvp(db.client, input);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(db.tx.users.upsert).not.toHaveBeenCalled();
    for (const [operation] of db.tx.items.upsert.mock.calls as unknown as [
      {
        update: object;
        where: { SERIAL_NO: string };
        create: { ADDED_BY: number };
      },
    ][]) {
      expect(operation.update).toEqual({});
      expect(operation.where.SERIAL_NO).toMatch(/^PPETS-MVP-/);
      expect(operation.create.ADDED_BY).toBe(42);
    }
  });
});
