import { PrismaClient } from '@prisma/client';

export default async function seedEmployees(prisma: PrismaClient) {
  await prisma.employees.createMany({
    data: [
      {
        ID_NUMBER: 10001,
        FIRSTNAME: 'John',
        LASTNAME: 'Doe',
        DEPARTMENT_ID: 1,
      },
      {
        ID_NUMBER: 10002,
        FIRSTNAME: 'Jane',
        LASTNAME: 'Smith',
        DEPARTMENT_ID: 2,
      },
      {
        ID_NUMBER: 10003,
        FIRSTNAME: 'Michael',
        LASTNAME: 'Johnson',
        DEPARTMENT_ID: 1,
      },
      {
        ID_NUMBER: 10004,
        FIRSTNAME: 'Emily',
        LASTNAME: 'Davis',
        DEPARTMENT_ID: 3,
      },
      {
        ID_NUMBER: 10005,
        FIRSTNAME: 'Daniel',
        LASTNAME: 'Garcia',
        DEPARTMENT_ID: 2,
      },
      {
        ID_NUMBER: 10006,
        FIRSTNAME: 'Sophia',
        LASTNAME: 'Martinez',
        DEPARTMENT_ID: 4,
      },
      {
        ID_NUMBER: 10007,
        FIRSTNAME: 'James',
        LASTNAME: 'Brown',
        DEPARTMENT_ID: 1,
      },
      {
        ID_NUMBER: 10008,
        FIRSTNAME: 'Olivia',
        LASTNAME: 'Wilson',
        DEPARTMENT_ID: 3,
      },
      {
        ID_NUMBER: 10009,
        FIRSTNAME: 'William',
        LASTNAME: 'Anderson',
        DEPARTMENT_ID: 2,
      },
      {
        ID_NUMBER: 10010,
        FIRSTNAME: 'Ava',
        LASTNAME: 'Thomas',
        DEPARTMENT_ID: 4,
      },
      {
        ID_NUMBER: 10011,
        FIRSTNAME: 'Benjamin',
        LASTNAME: 'Taylor',
        DEPARTMENT_ID: 1,
      },
      {
        ID_NUMBER: 10012,
        FIRSTNAME: 'Isabella',
        LASTNAME: 'Moore',
        DEPARTMENT_ID: 3,
      },
      {
        ID_NUMBER: 10013,
        FIRSTNAME: 'Lucas',
        LASTNAME: 'Jackson',
        DEPARTMENT_ID: 2,
      },
      {
        ID_NUMBER: 10014,
        FIRSTNAME: 'Mia',
        LASTNAME: 'Martin',
        DEPARTMENT_ID: 4,
      },
      {
        ID_NUMBER: 10015,
        FIRSTNAME: 'Henry',
        LASTNAME: 'Lee',
        DEPARTMENT_ID: 1,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seeding Employee Completed!\n');
}
