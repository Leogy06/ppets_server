import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { DatabaseService } from '../database/database.service';
import type { AppRequest, SessionUser } from '../core/types';
const member: SessionUser = {
  id: 2,
  employeeId: 7,
  departmentId: 1,
  email: 'm@example.test',
  name: 'Member',
  role: 'member',
};
const admin: SessionUser = { ...member, id: 1, employeeId: 1, role: 'admin' };
const subset = (value: Record<string, unknown>): unknown =>
  expect.objectContaining(value);
const id = '558b33ba-1097-4458-a68b-fdd5a5e58def';
function fixture() {
  const item = {
    ID: 4,
    ITEM_NAME: 'Laptop',
    DESCRIPTION: 'Work laptop',
    QUANTITY: 3,
    condition: 'GOOD',
    DELETE: 0,
    DEPARTMENT_ID: 1,
  };
  const row = {
    id,
    itemId: 4,
    quantity: 2,
    reason: 'Field work',
    status: 'PENDING',
    employeeId: 7,
    createdAt: new Date('2026-01-01'),
    returnedAt: null,
    reviewedAt: null as Date | null,
    item: { ITEM_NAME: 'Laptop' },
    employee: {
      FIRSTNAME: 'Jo',
      LASTNAME: 'Reyes',
      MIDDLENAME: null,
      SUFFIX: null,
      DELETED: 0,
      users: [
        { role: 2, is_active: 1, emailVerifiedAt: new Date('2026-01-01') },
      ],
    },
  };
  const db = {
    items: {
      findMany: jest.fn().mockResolvedValue([item]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(item),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(item),
    },
    transactions: {
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: unknown) => Promise<unknown>) =>
    run(db),
  );
  return {
    item,
    row,
    db,
    service: new AssetsService(db as unknown as DatabaseService),
  };
}
describe('asset request lifecycle', () => {
  it.each(['REPAIR', 'MAINTENANCE'])(
    'shows zero requestable units for %s without changing physical stock',
    async (condition) => {
      const { service, db, item } = fixture();
      item.condition = condition;
      const result = await service.listAssets(member, {
        page: 1,
        limit: 10,
        search: '',
      });
      expect(result.items[0].availableQuantity).toBe(0);
      expect(result.items[0].condition).toBe(condition);
      expect(result.total).toBe(1);
      expect(item.QUANTITY).toBe(3);
      expect(db.items.update).not.toHaveBeenCalled();
      expect(db.items.updateMany).not.toHaveBeenCalled();
    },
  );
  it('maps paginated assets and filters archived/foreign departments before querying', async () => {
    const { service, db } = fixture();
    expect(
      await service.listAssets(member, { page: 2, limit: 5, search: 'Lap' }),
    ).toEqual({
      items: [
        {
          id: 4,
          name: 'Laptop',
          description: 'Work laptop',
          availableQuantity: 3,
          condition: 'GOOD',
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
    });
    expect(db.items.findMany).toHaveBeenCalledWith(
      subset({
        skip: 5,
        take: 5,
        where: subset({
          DELETE: 0,
          OR: [{ DEPARTMENT_ID: null }, { DEPARTMENT_ID: 1 }],
        }),
      }),
    );
  });
  it('maps request records and scopes member and administrator lists', async () => {
    const { service, db } = fixture();
    const result = await service.listRequests(member, {
      page: 1,
      limit: 10,
      status: 'PENDING',
    });
    expect(result.items[0]).toEqual({
      id,
      assetId: 4,
      assetName: 'Laptop',
      quantity: 2,
      reason: 'Field work',
      status: 'PENDING',
      requestedBy: 'Jo Reyes',
      employeeId: 7,
      createdAt: '2026-01-01T00:00:00.000Z',
      returnedAt: null,
      reviewedAt: null,
    });
    expect(db.transactions.findMany).toHaveBeenLastCalledWith(
      subset({
        where: subset({ employeeId: 7, status: 'PENDING' }),
      }),
    );
    await service.listRequests(admin, { page: 1, limit: 10 });
    expect(db.transactions.findMany).toHaveBeenLastCalledWith(
      subset({
        where: subset({
          employee: {
            OR: [
              { CURRENT_DPT_ID: 1 },
              { CURRENT_DPT_ID: null, DEPARTMENT_ID: 1 },
            ],
          },
        }),
      }),
    );
  });
  it('creates a member request using authenticated ownership and rejects wrong role or quantity', async () => {
    const { service, db } = fixture();
    await expect(
      service.createRequest(member, {
        assetId: 4,
        quantity: 2,
        reason: ' Field work ',
      }),
    ).resolves.toHaveProperty('request.id', id);
    expect(db.transactions.create).toHaveBeenCalledWith(
      subset({
        data: { itemId: 4, employeeId: 7, quantity: 2, reason: 'Field work' },
      }),
    );
    await expect(
      service.createRequest(admin, {
        assetId: 4,
        quantity: 2,
        reason: 'Field work',
      }),
    ).rejects.toMatchObject({ status: 403 });
    for (const quantity of [0, -1, 1.5, 1000001])
      await expect(
        service.createRequest(member, {
          assetId: 4,
          quantity,
          reason: 'Field work',
        }),
      ).rejects.toMatchObject({ status: 400 });
  });
  it('rejects unavailable or nonlendable assets without creating requests', async () => {
    const { service, db, item } = fixture();
    for (const condition of ['REPAIR', 'MAINTENANCE']) {
      db.items.findFirst.mockResolvedValue({ ...item, condition });
      await expect(
        service.createRequest(member, {
          assetId: 4,
          quantity: 1,
          reason: 'Field work',
        }),
      ).rejects.toMatchObject({ status: 409 });
    }
    db.items.findFirst.mockResolvedValue({ ...item, QUANTITY: 0 });
    await expect(
      service.createRequest(member, {
        assetId: 4,
        quantity: 1,
        reason: 'Field work',
      }),
    ).rejects.toMatchObject({ status: 409 });
    db.items.findFirst.mockResolvedValue(null);
    await expect(
      service.createRequest(member, {
        assetId: 4,
        quantity: 1,
        reason: 'Field work',
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.transactions.create).not.toHaveBeenCalled();
  });
  it('claims pending approval and atomically decrements stock with availability conditions', async () => {
    const { service, db } = fixture();
    const result = await service.approve(admin, id);
    expect(result.request.status).toBe('APPROVED');
    expect(db.transactions.updateMany).toHaveBeenCalledWith(
      subset({
        where: subset({ id, status: 'PENDING' }),
      }),
    );
    expect(db.items.updateMany).toHaveBeenCalledWith(
      subset({
        where: subset({
          ID: 4,
          QUANTITY: { gte: 2 },
          DELETE: 0,
          condition: { notIn: ['REPAIR', 'MAINTENANCE'] },
        }),
        data: subset({ QUANTITY: { decrement: 2 } }),
      }),
    );
  });
  it('rejects approval conflicts so Prisma rolls back a failed conditional stock update', async () => {
    const { service, db } = fixture();
    db.items.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.approve(admin, id)).rejects.toMatchObject({
      status: 409,
    });
    db.transactions.updateMany.mockResolvedValue({ count: 0 });
    db.items.updateMany.mockClear();
    await expect(service.approve(admin, id)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.items.updateMany).not.toHaveBeenCalled();
    await expect(service.approve(member, id)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('returns an approved owned request once and restores exactly its quantity', async () => {
    const { service, db, row } = fixture();
    db.transactions.findFirst.mockResolvedValue({ ...row, status: 'APPROVED' });
    const result = await service.returnRequest(member, id);
    expect(result.request.status).toBe('RETURNED');
    expect(result.request.returnedAt).toEqual(expect.any(String));
    expect(db.transactions.updateMany).toHaveBeenCalledWith(
      subset({
        where: subset({
          id,
          status: 'APPROVED',
          employeeId: 7,
        }),
      }),
    );
    expect(db.items.update).toHaveBeenCalledWith(
      subset({
        where: { ID: 4 },
        data: subset({ QUANTITY: { increment: 2 } }),
      }),
    );
    db.transactions.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.returnRequest(member, id)).rejects.toMatchObject({
      status: 409,
    });
    expect(db.items.update).toHaveBeenCalledTimes(1);
  });
  it('denies wrong ownership and invalid status without changing stock', async () => {
    const { service, db, row } = fixture();
    db.transactions.findFirst.mockResolvedValue({
      ...row,
      status: 'APPROVED',
      employeeId: 9,
    });
    await expect(service.returnRequest(member, id)).rejects.toMatchObject({
      status: 403,
    });
    db.transactions.findFirst.mockResolvedValue(row);
    await expect(service.returnRequest(member, id)).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.returnRequest(admin, id)).rejects.toMatchObject({
      status: 403,
    });
    expect(db.items.update).not.toHaveBeenCalled();
    expect(db.transactions.updateMany).not.toHaveBeenCalled();
  });
});

// Persist claims/stock and roll both back on error, as an interactive transaction does.
// Serial execution models the database's competing conditional row claims.
function transactionalFixture() {
  const result = fixture();
  const { db, row, item } = result;
  let queue = Promise.resolve();
  db.$transaction.mockImplementation(
    async (run: (tx: unknown) => Promise<unknown>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      const beforeRow = structuredClone(row);
      const beforeItem = structuredClone(item);
      try {
        return await run(db);
      } catch (error) {
        Object.assign(row, beforeRow);
        Object.assign(item, beforeItem);
        throw error;
      } finally {
        release();
      }
    },
  );
  db.transactions.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { status: string; employeeId?: number };
      data: Record<string, unknown>;
    }) => {
      if (
        row.status !== where.status ||
        (where.employeeId !== undefined && row.employeeId !== where.employeeId)
      )
        return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  );
  db.items.updateMany.mockImplementation(
    async ({ data }: { data: { QUANTITY: { decrement: number } } }) => {
      if (item.QUANTITY < data.QUANTITY.decrement) return { count: 0 };
      item.QUANTITY -= data.QUANTITY.decrement;
      return { count: 1 };
    },
  );
  db.items.update.mockImplementation(
    async ({ data }: { data: { QUANTITY: { increment: number } } }) => {
      item.QUANTITY += data.QUANTITY.increment;
      return item;
    },
  );
  return result;
}

describe('complete request cycle', () => {
  it.each(['reject', 'cancel'] as const)(
    'reports a lost pending claim on %s without touching stock',
    async (action) => {
      const { service, db, item } = fixture();
      db.transactions.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service[action](action === 'reject' ? admin : member, id),
      ).rejects.toMatchObject({ status: 409 });
      expect(item.QUANTITY).toBe(3);
      expect(db.items.updateMany).not.toHaveBeenCalled();
      expect(db.items.update).not.toHaveBeenCalled();
    },
  );
  it.each(['reject', 'cancel'] as const)(
    'closes pending requests with %s without changing stock',
    async (action) => {
      const { service, row, item } = transactionalFixture();
      const result = await service[action](
        action === 'reject' ? admin : member,
        id,
      );
      expect(result.request.status).toBe(
        action === 'reject' ? 'REJECTED' : 'CANCEL',
      );
      expect(row.status).toBe(result.request.status);
      expect(item.QUANTITY).toBe(3);
      if (action === 'reject')
        expect(result.request.reviewedAt).toEqual(expect.any(String));
      else expect(result.request.reviewedAt).toBeNull();
      await expect(service.approve(admin, id)).rejects.toMatchObject({
        status: 409,
      });
      await expect(
        service[action](action === 'reject' ? admin : member, id),
      ).rejects.toMatchObject({ status: 409 });
      expect(item.QUANTITY).toBe(3);
    },
  );
  it('denies unauthorized rejection/cancellation and foreign ownership before writes', async () => {
    const { service, db, row, item } = transactionalFixture();
    await expect(service.reject(member, id)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.cancel(admin, id)).rejects.toMatchObject({
      status: 403,
    });
    row.employeeId = 99;
    await expect(service.cancel(member, id)).rejects.toMatchObject({
      status: 403,
    });
    expect(row.status).toBe('PENDING');
    expect(item.QUANTITY).toBe(3);
    expect(db.transactions.updateMany).not.toHaveBeenCalled();
  });
  it('hides out-of-department or absent rejection targets', async () => {
    const { service, db } = fixture();
    db.transactions.findFirst.mockResolvedValue(null);
    await expect(service.reject(admin, id)).rejects.toMatchObject({
      status: 404,
    });
    expect(db.transactions.findFirst).toHaveBeenCalledWith(
      subset({
        where: subset({
          id,
          employee: {
            OR: [
              { CURRENT_DPT_ID: 1 },
              { CURRENT_DPT_ID: null, DEPARTMENT_ID: 1 },
            ],
          },
        }),
      }),
    );
    expect(db.transactions.updateMany).not.toHaveBeenCalled();
  });
  it.each(['APPROVED', 'RETURNED', 'REJECTED', 'CANCEL'])(
    'does not reject or cancel a %s request',
    async (status) => {
      const { service, row, item } = transactionalFixture();
      row.status = status;
      await expect(service.reject(admin, id)).rejects.toMatchObject({
        status: 409,
      });
      await expect(service.cancel(member, id)).rejects.toMatchObject({
        status: 409,
      });
      expect(item.QUANTITY).toBe(3);
      expect(row.status).toBe(status);
    },
  );
  it('rolls back the pending claim when approval cannot allocate stock', async () => {
    const { service, row, item } = transactionalFixture();
    item.QUANTITY = 1;
    await expect(service.approve(admin, id)).rejects.toMatchObject({
      status: 409,
    });
    expect(row.status).toBe('PENDING');
    expect(row.reviewedAt).toBeNull();
    expect(item.QUANTITY).toBe(1);
  });
  it.each(['reject', 'cancel'] as const)(
    'allows exactly one winner when approval competes with %s',
    async (action) => {
      for (const approvalFirst of [true, false]) {
        const { service, row, item } = transactionalFixture();
        const close = () =>
          service[action](action === 'reject' ? admin : member, id);
        const approve = () => service.approve(admin, id);
        const outcomes = await Promise.allSettled(
          approvalFirst ? [approve(), close()] : [close(), approve()],
        );
        expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
          'fulfilled',
          'rejected',
        ]);
        const rejected = outcomes.find(
          (outcome) => outcome.status === 'rejected',
        );
        expect(rejected).toMatchObject({ reason: { status: 409 } });
        expect(item.QUANTITY).toBe(row.status === 'APPROVED' ? 1 : 3);
      }
    },
  );
  it('does not approve archived employees, inactive accounts or invalid legacy quantities', async () => {
    for (const scenario of [
      'archived',
      'inactive',
      'unverified',
      'zero',
      'negative',
      'fractional',
    ]) {
      const { service, row, item, db } = transactionalFixture();
      if (scenario === 'archived') row.employee.DELETED = 1;
      if (scenario === 'inactive') row.employee.users[0].is_active = 0;
      if (scenario === 'unverified') row.employee.users = [];
      if (scenario === 'zero') row.quantity = 0;
      if (scenario === 'negative') row.quantity = -1;
      if (scenario === 'fractional') row.quantity = 1.5;
      await expect(service.approve(admin, id)).rejects.toMatchObject({
        status: 409,
      });
      expect(row.status).toBe('PENDING');
      expect(item.QUANTITY).toBe(3);
      expect(db.transactions.updateMany).not.toHaveBeenCalled();
    }
  });
  it('does not restore malformed legacy quantities on return', async () => {
    const { service, row, item } = transactionalFixture();
    row.status = 'APPROVED';
    row.quantity = -2;
    await expect(service.returnRequest(member, id)).rejects.toMatchObject({
      status: 409,
    });
    expect(item.QUANTITY).toBe(3);
    expect(row.status).toBe('APPROVED');
  });
});

describe('summary contract', () => {
  it.each([member, admin])(
    'scopes aggregate totals for $role independently of pagination',
    async (user) => {
      const { service, db } = fixture();
      const assetAggregate = jest
        .fn()
        .mockResolvedValue({ _count: { ID: 23 }, _sum: { QUANTITY: 56 } });
      const requestAggregate = jest
        .fn()
        .mockResolvedValue({ _sum: { quantity: 12 } });
      Object.assign(db.items, { aggregate: assetAggregate });
      db.items.count.mockResolvedValue(23);
      Object.assign(db.transactions, { aggregate: requestAggregate });
      db.transactions.count.mockResolvedValueOnce(7).mockResolvedValueOnce(11);
      await expect(service.summary(user)).resolves.toEqual({
        assetTypes: 23,
        availableUnits: 56,
        pendingRequests: 7,
        assignedUnits: 12,
        returnedRequests: 11,
      });
      expect(assetAggregate).toHaveBeenCalledWith(
        subset({
          where: {
            DELETE: 0,
            OR: [{ DEPARTMENT_ID: null }, { DEPARTMENT_ID: 1 }],
            condition: { notIn: ['REPAIR', 'MAINTENANCE'] },
            QUANTITY: { gt: 0 },
          },
        }),
      );
      const scope =
        user.role === 'member'
          ? { employeeId: 7 }
          : {
              employee: {
                OR: [
                  { CURRENT_DPT_ID: 1 },
                  { CURRENT_DPT_ID: null, DEPARTMENT_ID: 1 },
                ],
              },
            };
      expect(requestAggregate).toHaveBeenCalledWith(
        subset({ where: { ...scope, status: 'APPROVED' } }),
      );
      expect(db.transactions.count).toHaveBeenNthCalledWith(1, {
        where: { ...scope, status: 'PENDING' },
      });
      expect(db.transactions.count).toHaveBeenNthCalledWith(2, {
        where: { ...scope, status: 'RETURNED' },
      });
    },
  );
  it('reports zero for empty aggregate sums', async () => {
    const { service, db } = fixture();
    db.items.count.mockResolvedValue(0);
    Object.assign(db.items, {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _count: { ID: 0 }, _sum: { QUANTITY: null } }),
    });
    Object.assign(db.transactions, {
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
    });
    db.transactions.count.mockResolvedValue(0);
    await expect(service.summary(member)).resolves.toEqual({
      assetTypes: 0,
      availableUnits: 0,
      pendingRequests: 0,
      assignedUnits: 0,
      returnedRequests: 0,
    });
  });
  it('counts all catalog types but sums only positive requestable quantities without stock writes', async () => {
    const { service, db } = fixture();
    const assets = [
      { condition: 'GOOD', QUANTITY: 4 },
      { condition: 'FAIR', QUANTITY: 2 },
      { condition: 'REPAIR', QUANTITY: 8 },
      { condition: 'MAINTENANCE', QUANTITY: 6 },
      { condition: 'EXCELLENT', QUANTITY: 0 },
      { condition: 'POOR', QUANTITY: -3 },
    ];
    const before = structuredClone(assets);
    db.items.count.mockResolvedValue(assets.length);
    Object.assign(db.items, {
      aggregate: jest.fn().mockImplementation(
        async ({
          where,
        }: {
          where: {
            condition?: { notIn: string[] };
            QUANTITY?: { gt: number };
          };
        }) => ({
          _count: { ID: assets.length },
          _sum: {
            QUANTITY: assets
              .filter(
                (asset) =>
                  !where.condition?.notIn.includes(asset.condition) &&
                  (where.QUANTITY === undefined ||
                    asset.QUANTITY > where.QUANTITY.gt),
              )
              .reduce((total, asset) => total + asset.QUANTITY, 0),
          },
        }),
      ),
    });
    Object.assign(db.transactions, {
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
    });
    const result = await service.summary(member);
    expect(result.assetTypes).toBe(6);
    expect(result.availableUnits).toBe(6);
    expect(db.items.count).toHaveBeenCalledWith({
      where: {
        DELETE: 0,
        OR: [{ DEPARTMENT_ID: null }, { DEPARTMENT_ID: 1 }],
      },
    });
    expect(assets).toEqual(before);
    expect(db.items.update).not.toHaveBeenCalled();
    expect(db.items.updateMany).not.toHaveBeenCalled();
  });
});
describe('assets HTTP input contract', () => {
  const input = (
    body: unknown = {},
    query: unknown = {},
    params: unknown = {},
  ) => ({ body, query, params, user: member }) as AppRequest;
  it('rejects unknown fields, invalid list status and invalid mutation identifiers', () => {
    const { service } = fixture();
    const controller = new AssetsController(service);
    expect(() => controller.listAssets(input({ extra: 1 }))).toThrow();
    expect(() =>
      controller.listRequests(input({}, { status: 'INVALID' })),
    ).toThrow();
    expect(() =>
      controller.createRequest(
        input({ assetId: 4, quantity: 1, reason: 'why', employeeId: 99 }),
      ),
    ).toThrow();
    expect(() =>
      controller.approve(input({}, {}, { id: 'not-uuid' })),
    ).toThrow();
    for (const action of ['reject', 'cancel'] as const) {
      expect(() =>
        controller[action](input({ reason: 'unaccepted' }, {}, { id })),
      ).toThrow();
      expect(() =>
        controller[action](input({}, { force: 'true' }, { id })),
      ).toThrow();
      expect(() =>
        controller[action](input({}, {}, { id: 'not-uuid' })),
      ).toThrow();
    }
    expect(() => controller.summary(input({}, { employeeId: 99 }))).toThrow();
  });
});
