import { Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { parseConfig } from './config';
import { configureApp } from './http';
import type { RateLimitStore } from './rate-limit';
const environment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'mysql://localhost/test',
  CLIENT_BASEURL: 'http://localhost:3000',
  SESSION_SECRET: 'x'.repeat(32),
  AUTH_RATE_LIMIT: '2',
  API_RATE_LIMIT: '3',
  RATE_WINDOW_SECONDS: '2',
};
@Controller()
class ProbeController {
  @Get('health') health() {
    return { status: 'ok' };
  }
  @Get('api/assets') assets() {
    return { items: [] };
  }
  @Post('api/auth/:action') auth() {
    return { message: 'ok' };
  }
}
async function build(
  extra: NodeJS.ProcessEnv = {},
  store?: RateLimitStore,
): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();
  const app = module.createNestApplication({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, parseConfig({ ...environment, ...extra }), {
    rateLimitStore: store,
  });
  await app.init();
  return app;
}
type ErrorBody = { error: { code: string; requestId: string } };
function headers(response: request.Response) {
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-frame-options']).toBe('DENY');
  expect(response.headers['referrer-policy']).toBe('no-referrer');
  expect(response.headers['content-security-policy']).toEqual(
    expect.any(String),
  );
  expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-powered-by']).toBeUndefined();
}
describe('HTTP hardening', () => {
  const apps: INestApplication[] = [];
  beforeEach(() =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
  );
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    jest.restoreAllMocks();
  });
  async function app(extra: NodeJS.ProcessEnv = {}, store?: RateLimitStore) {
    const value = await build(extra, store);
    apps.push(value);
    return value;
  }
  it('shares strict auth limit across endpoints and ignores spoofed forwarded addresses', async () => {
    const instance = await app();
    const server = instance.getHttpServer() as Server;
    await request(server)
      .post('/API/AUTH/LOGIN/')
      .set('X-Forwarded-For', '1.1.1.1')
      .expect(201);
    await request(server)
      .post('/api/auth/signup')
      .set('X-Forwarded-For', '2.2.2.2')
      .expect(201);
    const denied = await request(server)
      .post('/api/auth/forgot-password')
      .set('X-Forwarded-For', '3.3.3.3')
      .expect(429);
    expect((denied.body as ErrorBody).error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      requestId: denied.headers['x-request-id'],
    });
    expect(denied.headers['retry-after']).toBe('2');
    headers(denied);
  });
  it('uses moderate API bucket for sessions/logout and excludes health and preflight', async () => {
    const instance = await app();
    const server = instance.getHttpServer() as Server;
    for (let i = 0; i < 5; i++)
      await request(server).get('/health').expect(200);
    for (let i = 0; i < 5; i++)
      await request(server)
        .options('/api/assets')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);
    await request(server).get('/api/assets').expect(200);
    await request(server).post('/api/auth/logout').expect(201);
    await request(server).get('/api/auth/session').expect(404);
    await request(server).get('/api/assets').expect(429);
  });
  it('applies headers to origin and parsing errors', async () => {
    const instance = await app();
    const server = instance.getHttpServer() as Server;
    const cors = await request(server)
      .get('/api/assets')
      .set('Origin', 'https://evil.example')
      .expect(403);
    headers(cors);
    const bad = await request(server)
      .post('/API/AUTH/LOGIN/')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    headers(bad);
    expect((bad.body as ErrorBody).error.code).toBe('INVALID_JSON');
    expect(bad.headers['strict-transport-security']).toBeUndefined();
  });
  it('allows explicit single proxy trust and replaceable stores', async () => {
    const calls: string[] = [];
    const store: RateLimitStore = {
      consume: (key) => {
        calls.push(key);
        return { allowed: false, retryAfter: 7, remaining: 0 };
      },
    };
    const instance = await app(
      { TRUST_PROXY: 'true', NODE_ENV: 'production' },
      store,
    );
    const response = await request(instance.getHttpServer() as Server)
      .get('/api/assets')
      .set('X-Forwarded-For', '1.2.3.4')
      .expect(429);
    expect(calls).toEqual(['1.2.3.4:api']);
    expect(response.headers['retry-after']).toBe('7');
    expect(response.headers['strict-transport-security']).toEqual(
      expect.any(String),
    );
  });
  it('awaits asynchronous replacement stores before allowing or denying a request', async () => {
    let count = 0;
    const store: RateLimitStore = {
      consume: async () => {
        await Promise.resolve();
        count++;
        return { allowed: count === 1, retryAfter: 5, remaining: 0 };
      },
    };
    const instance = await app({}, store);
    const server = instance.getHttpServer() as Server;
    await request(server).get('/api/assets').expect(200);
    const denied = await request(server).get('/api/assets').expect(429);
    expect(denied.headers['retry-after']).toBe('5');
  });
  it('sanitizes asynchronous store rejection with correlation and security headers', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const store: RateLimitStore = {
      consume: async () => {
        await Promise.resolve();
        throw new Error('private store credential');
      },
    };
    const instance = await app({}, store);
    const failed = await request(instance.getHttpServer() as Server)
      .get('/api/assets')
      .expect(500);
    expect((failed.body as ErrorBody).error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: failed.headers['x-request-id'],
    });
    expect(JSON.stringify(failed.body)).not.toContain('private');
    headers(failed);
  });
  it('rejects malformed database locations without echoing configuration values', () => {
    for (const value of [
      'mysql://',
      'mysql://localhost',
      'mysql://localhost/',
      'mysql:///database',
      'postgres://localhost/private',
    ]) {
      expect(() =>
        parseConfig({ ...environment, DATABASE_URL: value }),
      ).toThrow('DATABASE_URL');
      expect(() =>
        parseConfig({ ...environment, DATABASE_URL: value }),
      ).not.toThrow(value);
    }
  });
  it('validates explicit proxy configuration without truthiness coercion', () => {
    expect(parseConfig(environment).TRUST_PROXY).toBe(false);
    for (const value of ['false', '0'])
      expect(
        parseConfig({ ...environment, TRUST_PROXY: value }).TRUST_PROXY,
      ).toBe(false);
    for (const value of ['true', '1'])
      expect(
        parseConfig({ ...environment, TRUST_PROXY: value }).TRUST_PROXY,
      ).toBe(true);
    expect(() =>
      parseConfig({ ...environment, TRUST_PROXY: 'anything' }),
    ).toThrow('TRUST_PROXY');
  });
});
