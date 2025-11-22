import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    path: process.env.DATABASE_URL!,
  },
});
