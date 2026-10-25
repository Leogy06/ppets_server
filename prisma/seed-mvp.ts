import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync } from 'node:fs';

export async function seedMvp(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<void> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  if (
    !email ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid email address.');
  }
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.',
    );
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.users.findUnique({ where: { email } });
    if (existing && existing.role !== 1) {
      throw new Error(
        'Existing seed account is not an admin; refusing to change its role.',
      );
    }
    const admin =
      existing ??
      (await tx.users.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password: await bcrypt.hash(password, 12),
          role: 1,
          is_active: 1,
          emailVerifiedAt: new Date(),
          employee: {
            create: {
              ID_NUMBER: 2026001,
              FIRSTNAME: 'PPETS',
              LASTNAME: 'Administrator',
              DEPARTMENT_ID: 1,
              CURRENT_DPT_ID: 1,
              DELETED: 0,
            },
          },
        },
      }));
    // A concurrent bootstrap must never turn an existing member into an admin.
    if (admin.role !== 1) {
      throw new Error(
        'Existing seed account is not an admin; refusing to change its role.',
      );
    }
    const samples = [
      {
        SERIAL_NO: 'PPETS-MVP-LAPTOP-001',
        ITEM_NAME: 'Office Laptop',
        DESCRIPTION: '14-inch office laptop for staff assignments',
        UNIT_VALUE: 42000,
        QUANTITY: 5,
      },
      {
        SERIAL_NO: 'PPETS-MVP-PROJECTOR-001',
        ITEM_NAME: 'Meeting Room Projector',
        DESCRIPTION: 'Portable presentation projector for meetings',
        UNIT_VALUE: 28000,
        QUANTITY: 2,
      },
      {
        SERIAL_NO: 'PPETS-MVP-CHAIR-001',
        ITEM_NAME: 'Ergonomic Office Chair',
        DESCRIPTION: 'Adjustable office chair for employee workspaces',
        UNIT_VALUE: 6500,
        QUANTITY: 10,
      },
    ];
    for (const sample of samples) {
      await tx.items.upsert({
        where: { SERIAL_NO: sample.SERIAL_NO },
        update: {},
        create: {
          ...sample,
          originalQuantity: sample.QUANTITY,
          RECEIVED_AT: new Date('2026-10-25T00:00:00.000Z'),
          ADDED_BY: admin.emp_id,
        },
      });
    }
  });
}

if (require.main === module) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const prisma = new PrismaClient();
  seedMvp(prisma, {
    email: process.env.SEED_ADMIN_EMAIL ?? '',
    password: process.env.SEED_ADMIN_PASSWORD ?? '',
  })
    .then(() => console.log('MVP bootstrap completed.'))
    .catch(() => {
      console.error(
        'MVP bootstrap failed. Check seed configuration and database availability.',
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
