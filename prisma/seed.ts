import { PrismaClient } from '@prisma/client';
import seedEmployees from './seeders/employee.seed';
import 'dotenv/config';
import seedDepartments from './seeders/department.seed';
import seedUsers from './seeders/users.seed';
import seedItems from './seeders/items.seed';
const prisma = new PrismaClient();

const target = process.argv[2];

async function main() {
  console.log('Starting database seeding...');

  if (!target || target === 'employees') {
    await seedEmployees(prisma);
  }

  if (!target || target === 'departments') {
    await seedDepartments(prisma);
  }

  if (!target || target === 'users') {
    await seedUsers(prisma);
  }

  if (!target || target === 'items') {
    await seedItems(prisma);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Failed to seed: ', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
