import type { Request } from 'express';
import { z } from 'zod';
import { parseRequest } from './validation';
const req = (
  body: unknown = undefined,
  query: unknown = {},
  params: unknown = {},
) => ({ body, query, params }) as Request;
describe('request validation', () => {
  it('accepts missing body as empty and parses each input schema', () => {
    expect(parseRequest(req())).toEqual({ body: {}, query: {}, params: {} });
    expect(
      parseRequest(
        req({ count: 2 }, { page: '3' }, { id: '7' }),
        z.object({ count: z.number().int() }).strict(),
        z.object({ page: z.coerce.number().int() }).strict(),
        z.object({ id: z.coerce.number().int() }).strict(),
      ),
    ).toEqual({ body: { count: 2 }, query: { page: 3 }, params: { id: 7 } });
  });
  it('rejects unexpected body, query and route parameters by default', () => {
    for (const input of [
      req({ admin: true }),
      req(undefined, { extra: '1' }),
      req(undefined, {}, { extra: '1' }),
    ])
      expect(() => parseRequest(input)).toThrow('Request validation failed.');
  });
  it('rejects unknown body keys when a body is accepted', () => {
    expect(() =>
      parseRequest(
        req({ name: 'A', role: 'admin' }),
        z.object({ name: z.string() }).strict(),
      ),
    ).toThrow('Request validation failed.');
  });
});
