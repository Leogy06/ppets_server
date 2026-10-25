import { Test } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppError } from './app-error';
type ErrorBody = { error: { code: string; requestId: string } };
import { z } from 'zod';
import { parseConfig } from './config';
import { parse } from './validation';
import { configureApp } from './http';
import { HealthController } from './health.controller';
const environment = {
  DATABASE_URL: 'mysql://localhost/test',
  CLIENT_BASEURL: 'http://localhost:3000',
  SESSION_SECRET: 'x'.repeat(32),
  NODE_ENV: 'test',
};
@Controller('failure')
class FailureController {
  @Get() fail() {
    throw new Error('private database password');
  }
}
describe('foundation', () => {
  it('validates config without leaking supplied values', () => {
    expect(() =>
      parseConfig({ ...environment, SESSION_SECRET: 'private' }),
    ).toThrow('SESSION_SECRET');
    expect(() =>
      parseConfig({ ...environment, SESSION_SECRET: 'private' }),
    ).not.toThrow('private');
    expect(() =>
      parseConfig({ ...environment, DATABASE_URL: undefined }),
    ).toThrow('DATABASE_URL');
    expect(() =>
      parseConfig({ ...environment, CLIENT_BASEURL: 'http://localhost/path' }),
    ).toThrow('CLIENT_BASEURL');
    expect(parseConfig(environment).PORT).toBe(4001);
    expect(parseConfig(environment).EMAIL_STUB_DIR).toBe('.local-mail');
  });
  it('rejects unknown input fields', () => {
    expect(() => parse(z.object({}).strict(), { role: 'admin' })).toThrow(
      AppError,
    );
  });
  describe('HTTP', () => {
    let app: INestApplication;
    let requestLog: jest.SpyInstance<void, unknown[]>;
    beforeEach(() => {
      requestLog = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [HealthController, FailureController],
      }).compile();
      app = module.createNestApplication({ bodyParser: false, logger: false });
      configureApp(app, parseConfig(environment));
      await app.init();
    });
    afterAll(async () => {
      await app.close();
    });
    it('provides correlation and liveness', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/health')
        .set('x-request-id', 'untrusted')
        .expect(200);
      expect(response.body).toEqual({ status: 'ok' });
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(requestLog).toHaveBeenCalledTimes(1);
      const entry = JSON.parse(requestLog.mock.calls[0][0] as string) as Record<
        string,
        unknown
      >;
      expect(entry).toEqual({
        level: 'info',
        event: 'http_request',
        requestId: response.headers['x-request-id'],
        method: 'GET',
        path: '/health',
        status: 200,
        durationMs: expect.any(Number) as unknown,
      });
    });
    it('standardizes 404 and strict query errors', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/missing')
        .expect(404);
      expect((response.body as ErrorBody).error.requestId).toBe(
        response.headers['x-request-id'],
      );
      await request(app.getHttpServer() as Server)
        .get('/health?extra=1')
        .expect(400);
    });
    it('sanitizes unknown exceptions', async () => {
      const log = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const response = await request(app.getHttpServer() as Server)
        .get('/failure')
        .expect(500);
      expect((response.body as ErrorBody).error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(response.body)).not.toContain('private');
      expect(log).toHaveBeenCalledTimes(1);
      const errorEntry = JSON.parse(log.mock.calls[0][0] as string) as Record<
        string,
        unknown
      >;
      expect(errorEntry).toMatchObject({
        level: 'error',
        event: 'request_failed',
        requestId: response.headers['x-request-id'],
      });
      expect(errorEntry.stack).toEqual(expect.any(String));
      log.mockRestore();
    });
    it('standardizes malformed JSON and payload limits', async () => {
      const bad = await request(app.getHttpServer() as Server)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{')
        .expect(400);
      expect((bad.body as ErrorBody).error.code).toBe('INVALID_JSON');
      expect((bad.body as ErrorBody).error.requestId).toBe(
        bad.headers['x-request-id'],
      );
      const large = await request(app.getHttpServer() as Server)
        .post('/health')
        .send({ value: 'x'.repeat(40000) })
        .expect(413);
      expect((large.body as ErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
    });
    it('accepts only configured origins', async () => {
      await request(app.getHttpServer() as Server)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
        .expect(200);
      const response = await request(app.getHttpServer() as Server)
        .post('/health')
        .set('Origin', 'https://evil.example')
        .expect(403);
      expect((response.body as ErrorBody).error.code).toBe(
        'ORIGIN_NOT_ALLOWED',
      );
    });
  });
});
