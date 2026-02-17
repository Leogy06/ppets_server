import { PrismaClient } from '@prisma/client';
import seedEmployees from './seeders/employee.seed';
import 'dotenv/config';
const prisma = new PrismaClient();

prisma.employees.findMany();

async function main() {
  console.log('Starting database seeding...');

  await seedEmployees(prisma);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Failed to seed: ', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
