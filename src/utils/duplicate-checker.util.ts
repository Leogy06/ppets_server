// src/utils/check-duplicate-field.ts
import { PrismaClient } from '@prisma/client';

export async function checkDuplicateField(
  prisma: PrismaClient,
  table: keyof PrismaClient,
  fieldName: string,
  value: string | undefined,
  excludeId?: number,
): Promise<boolean> {
  if (!value) return false;

  const existing = await (prisma[table] as any).findFirst({
    where: {
      [fieldName]: value,
      ...(excludeId ? { NOT: { ID: excludeId } } : {}),
    },
  });

  return !!existing;
}
