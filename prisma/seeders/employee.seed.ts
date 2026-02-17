import { PrismaClient } from '@prisma/client';

export default async function seedEmployees(prisma: PrismaClient) {
  await prisma.employees.create({
    data: {
      ID_NUMBER: 12345,
      FIRSTNAME: 'John',
      LASTNAME: 'Doe',
      DEPARTMENT_ID: 1,
    },
  });
}
