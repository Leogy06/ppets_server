import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../core/app-error';
import { can } from '../core/policy';
import type { Action } from '../core/policy';
import type { SessionUser } from '../core/types';
import { parse } from '../core/validation';
import { DatabaseService } from '../database/database.service';
const pagination = {
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};
export const assetQuerySchema = z
  .object({ ...pagination, search: z.string().trim().max(100).default('') })
  .strict();
export const requestQuerySchema = z
  .object({
    ...pagination,
    status: z
      .enum(['PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'CANCEL'])
      .optional(),
  })
  .strict();
export const createRequestSchema = z
  .object({
    assetId: z.number().int().positive(),
    quantity: z.number().int().positive().max(1000000),
    reason: z.string().trim().min(3).max(255),
  })
  .strict();
export const requestIdSchema = z.object({ id: z.uuid() }).strict();
const include = {
  item: { select: { ITEM_NAME: true } },
  employee: {
    select: {
      FIRSTNAME: true,
      LASTNAME: true,
      MIDDLENAME: true,
      SUFFIX: true,
      DELETED: true,
      users: { select: { role: true, is_active: true, emailVerifiedAt: true } },
    },
  },
} satisfies Prisma.transactionsInclude;
type RequestRow = Prisma.transactionsGetPayload<{ include: typeof include }>;
type AssetQuery = z.infer<typeof assetQuerySchema>;
type RequestQuery = z.infer<typeof requestQuerySchema>;
type RequestInput = z.infer<typeof createRequestSchema>;
function authorize(
  user: SessionUser,
  action: Action,
  resource?: { ownerId?: number },
): void {
  if (!can(user, action, resource))
    throw new AppError('FORBIDDEN', 403, 'Access is not allowed.');
}
function assetScope(user: SessionUser): Prisma.itemsWhereInput {
  return {
    DELETE: 0,
    OR: [{ DEPARTMENT_ID: null }, { DEPARTMENT_ID: user.departmentId }],
  };
}
function requestScope(user: SessionUser): Prisma.transactionsWhereInput {
  return user.role === 'member'
    ? { employeeId: user.employeeId }
    : {
        employee: {
          OR: [
            { CURRENT_DPT_ID: user.departmentId },
            { CURRENT_DPT_ID: null, DEPARTMENT_ID: user.departmentId },
          ],
        },
      };
}
function serialize(row: RequestRow) {
  return {
    id: row.id,
    assetId: row.itemId,
    assetName: row.item.ITEM_NAME,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    requestedBy: [
      row.employee.FIRSTNAME,
      row.employee.MIDDLENAME,
      row.employee.LASTNAME,
      row.employee.SUFFIX,
    ]
      .filter(Boolean)
      .join(' '),
    employeeId: row.employeeId,
    createdAt: row.createdAt.toISOString(),
    returnedAt: row.returnedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}
function conflict(): never {
  throw new AppError(
    'REQUEST_CONFLICT',
    409,
    'The request or available stock changed. Refresh and try again.',
  );
}
@Injectable()
export class AssetsService {
  constructor(private readonly db: DatabaseService) {}
  async summary(user: SessionUser) {
    authorize(user, 'assets:read');
    return this.db.$transaction(async (tx) => {
      const scope = requestScope(user);
      const [assetTypes, assets, pendingRequests, assigned, returnedRequests] =
        await Promise.all([
          tx.items.count({ where: assetScope(user) }),
          tx.items.aggregate({
            where: {
              ...assetScope(user),
              condition: { notIn: ['REPAIR', 'MAINTENANCE'] },
              QUANTITY: { gt: 0 },
            },
            _sum: { QUANTITY: true },
          }),
          tx.transactions.count({ where: { ...scope, status: 'PENDING' } }),
          tx.transactions.aggregate({
            where: { ...scope, status: 'APPROVED' },
            _sum: { quantity: true },
          }),
          tx.transactions.count({ where: { ...scope, status: 'RETURNED' } }),
        ]);
      return {
        assetTypes,
        availableUnits: assets._sum.QUANTITY ?? 0,
        pendingRequests,
        assignedUnits: assigned._sum.quantity ?? 0,
        returnedRequests,
      };
    });
  }
  async listAssets(user: SessionUser, query: AssetQuery) {
    authorize(user, 'assets:read');
    const { page, limit, search } = parse(assetQuerySchema, query);
    const where: Prisma.itemsWhereInput = {
      ...assetScope(user),
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { ITEM_NAME: { contains: search } },
                  { DESCRIPTION: { contains: search } },
                ],
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.items.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ ITEM_NAME: 'asc' }, { ID: 'asc' }],
      }),
      this.db.items.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.ID,
        name: row.ITEM_NAME,
        description: row.DESCRIPTION,
        availableQuantity: ['REPAIR', 'MAINTENANCE'].includes(row.condition)
          ? 0
          : Math.max(0, row.QUANTITY),
        condition: row.condition,
      })),
      total,
      page,
      limit,
    };
  }
  async listRequests(user: SessionUser, query: RequestQuery) {
    authorize(user, 'requests:list');
    const { page, limit, status } = parse(requestQuerySchema, query);
    const where: Prisma.transactionsWhereInput = {
      ...requestScope(user),
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.transactions.findMany({
        where,
        include,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.db.transactions.count({ where }),
    ]);
    return { items: rows.map(serialize), total, page, limit };
  }
  async createRequest(user: SessionUser, input: RequestInput) {
    authorize(user, 'requests:create');
    const body = parse(createRequestSchema, input);
    const asset = await this.db.items.findFirst({
      where: { ID: body.assetId, ...assetScope(user) },
    });
    if (!asset) throw new AppError('NOT_FOUND', 404, 'Asset not found.');
    if (
      ['REPAIR', 'MAINTENANCE'].includes(asset.condition) ||
      asset.QUANTITY < body.quantity
    )
      conflict();
    const row = await this.db.transactions.create({
      data: {
        itemId: body.assetId,
        employeeId: user.employeeId,
        quantity: body.quantity,
        reason: body.reason,
      },
      include,
    });
    return { request: serialize(row) };
  }
  async approve(user: SessionUser, id: string) {
    authorize(user, 'requests:approve');
    parse(requestIdSchema, { id });
    return this.db.$transaction(async (tx) => {
      const row = await tx.transactions.findFirst({
        where: { id, ...requestScope(user) },
        include,
      });
      if (!row) throw new AppError('NOT_FOUND', 404, 'Request not found.');
      if (
        row.status !== 'PENDING' ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity <= 0 ||
        row.employee.DELETED === 1 ||
        !row.employee.users.some(
          (account) =>
            account.role === 2 &&
            account.is_active === 1 &&
            account.emailVerifiedAt,
        )
      )
        conflict();
      const now = new Date();
      const claim = await tx.transactions.updateMany({
        where: {
          id,
          status: 'PENDING',
          ...requestScope(user),
          AND: [
            {
              employee: {
                OR: [{ DELETED: null }, { DELETED: { not: 1 } }],
                users: {
                  some: {
                    role: 2,
                    is_active: 1,
                    emailVerifiedAt: { not: null },
                  },
                },
              },
            },
          ],
        },
        data: {
          status: 'APPROVED',
          reviewedAt: now,
          updatedAt: now,
          updatedBy: user.id,
        },
      });
      if (claim.count !== 1) conflict();
      const stock = await tx.items.updateMany({
        where: {
          ID: row.itemId,
          ...assetScope(user),
          QUANTITY: { gte: row.quantity },
          condition: { notIn: ['REPAIR', 'MAINTENANCE'] },
        },
        data: { QUANTITY: { decrement: row.quantity }, updatedAt: now },
      });
      if (stock.count !== 1) conflict();
      return {
        request: serialize({ ...row, status: 'APPROVED', reviewedAt: now }),
      };
    });
  }
  reject(user: SessionUser, id: string) {
    return this.closePending(user, id, 'REJECTED');
  }
  cancel(user: SessionUser, id: string) {
    return this.closePending(user, id, 'CANCEL');
  }
  private async closePending(
    user: SessionUser,
    id: string,
    status: 'REJECTED' | 'CANCEL',
  ) {
    const action =
      status === 'REJECTED' ? 'requests:reject' : 'requests:cancel';
    authorize(user, action);
    parse(requestIdSchema, { id });
    return this.db.$transaction(async (tx) => {
      const row = await tx.transactions.findFirst({
        where: { id, ...(status === 'REJECTED' ? requestScope(user) : {}) },
        include,
      });
      if (!row) throw new AppError('NOT_FOUND', 404, 'Request not found.');
      if (status === 'CANCEL')
        authorize(user, action, { ownerId: row.employeeId });
      if (row.status !== 'PENDING') conflict();
      const now = new Date();
      const claim = await tx.transactions.updateMany({
        where: { id, status: 'PENDING', ...requestScope(user) },
        data: {
          status,
          ...(status === 'REJECTED' ? { reviewedAt: now } : {}),
          updatedAt: now,
          updatedBy: user.id,
        },
      });
      if (claim.count !== 1) conflict();
      return {
        request: serialize({
          ...row,
          status,
          ...(status === 'REJECTED' ? { reviewedAt: now } : {}),
        }),
      };
    });
  }
  async returnRequest(user: SessionUser, id: string) {
    authorize(user, 'requests:return');
    parse(requestIdSchema, { id });
    return this.db.$transaction(async (tx) => {
      const row = await tx.transactions.findFirst({ where: { id }, include });
      if (!row) throw new AppError('NOT_FOUND', 404, 'Request not found.');
      authorize(user, 'requests:return', { ownerId: row.employeeId });
      if (
        row.status !== 'APPROVED' ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity <= 0
      )
        conflict();
      const now = new Date();
      const claim = await tx.transactions.updateMany({
        where: { id, status: 'APPROVED', employeeId: user.employeeId },
        data: {
          status: 'RETURNED',
          returnedAt: now,
          updatedAt: now,
          updatedBy: user.id,
        },
      });
      if (claim.count !== 1) conflict();
      await tx.items.update({
        where: { ID: row.itemId },
        data: { QUANTITY: { increment: row.quantity }, updatedAt: now },
      });
      return {
        request: serialize({ ...row, status: 'RETURNED', returnedAt: now }),
      };
    });
  }
}
