import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
  schema: 'prisma/schema.prisma',
  // This is the key fix for the "exports is not defined" error
});
