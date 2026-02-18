import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

export default async function seedUsers(prisma: PrismaClient) {
  // Hash password once and reuse
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const users = [
    { emp_id: 1, username: 'jdoe', email: 'jdoe@example.com', role: 1 },
    { emp_id: 2, username: 'jsmith', email: 'jsmith@example.com', role: 2 },
    { emp_id: 3, username: 'mjohnson', email: 'mjohnson@example.com', role: 1 },
    { emp_id: 4, username: 'edavis', email: 'edavis@example.com', role: 2 },
    { emp_id: 5, username: 'dgarcia', email: 'dgarcia@example.com', role: 1 },
    {
      emp_id: 6,
      username: 'smartinez',
      email: 'smartinez@example.com',
      role: 3,
    },
    { emp_id: 7, username: 'jbrown', email: 'jbrown@example.com', role: 1 },
    { emp_id: 8, username: 'owilson', email: 'owilson@example.com', role: 2 },
    {
      emp_id: 9,
      username: 'wanderson',
      email: 'wanderson@example.com',
      role: 1,
    },
    { emp_id: 10, username: 'athomas', email: 'athomas@example.com', role: 3 },
    { emp_id: 11, username: 'btaylor', email: 'btaylor@example.com', role: 1 },
    { emp_id: 12, username: 'imoore', email: 'imoore@example.com', role: 2 },
    {
      emp_id: 13,
      username: 'ljackson',
      email: 'ljackson@example.com',
      role: 1,
    },
    { emp_id: 14, username: 'mmartin', email: 'mmartin@example.com', role: 3 },
    { emp_id: 15, username: 'hlee', email: 'hlee@example.com', role: 1 },
  ];

  for (const user of users) {
    await prisma.users.upsert({
      where: { username: user.username! },
      update: {},

      create: {
        ...user,
        password: hashedPassword,
      },
    });
  }

  console.log('Seeding users completed!\n');
}
