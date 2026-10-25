import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from './app-error';
export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed.');
  return result.data;
}
const empty = z.object({}).strict();
export function parseRequest<
  B extends z.ZodType = typeof empty,
  Q extends z.ZodType = typeof empty,
  P extends z.ZodType = typeof empty,
>(
  req: Request,
  bodySchema: B = empty as unknown as B,
  querySchema: Q = empty as unknown as Q,
  paramsSchema: P = empty as unknown as P,
): { body: z.infer<B>; query: z.infer<Q>; params: z.infer<P> } {
  return {
    body: parse(bodySchema, (req.body as unknown) ?? {}),
    query: parse(querySchema, req.query),
    params: parse(paramsSchema, req.params),
  };
}
