import { z } from 'zod';
const origins = z
  .string()
  .min(1)
  .refine((value) =>
    value.split(',').every((entry) => {
      try {
        const url = new URL(entry.trim());
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          url.origin === entry.trim()
        );
      } catch {
        return false;
      }
    }),
  );
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  TRUST_PROXY: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((value) => value === 'true' || value === '1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === 'mysql:' &&
          url.hostname.length > 0 &&
          url.pathname.slice(1).trim().length > 0
        );
      } catch {
        return false;
      }
    }),
  CLIENT_BASEURL: origins,
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  EMAIL_MODE: z.literal('stub').default('stub'),
  EMAIL_STUB_DIR: z.string().min(1).default('.local-mail'),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
});
export type AppConfig = z.infer<typeof schema>;
export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  return result.data;
}
