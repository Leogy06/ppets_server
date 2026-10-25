import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { InMemoryRateLimitStore } from './rate-limit';
import type { RateLimitStore } from './rate-limit';
import type { Express } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './config';
import type { AppRequest } from './types';
import { AppError, AppExceptionFilter, sendError } from './app-error';
export function configureApp(
  app: INestApplication,
  config: AppConfig,
  options: { rateLimitStore?: RateLimitStore } = {},
): void {
  const server = app.getHttpAdapter().getInstance() as Express;
  server.disable('x-powered-by');
  server.set('trust proxy', config.TRUST_PROXY ? 1 : false);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity:
        config.NODE_ENV === 'production' ? undefined : false,
      xFrameOptions: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  const store = options.rateLimitStore ?? new InMemoryRateLimitStore();
  const allowedOrigins = config.CLIENT_BASEURL.split(',').map((origin) =>
    origin.trim(),
  );
  app.use((request: Request, res: Response, next: NextFunction) => {
    const req = request as AppRequest;
    req.requestId = randomUUID();
    res.setHeader('x-request-id', req.requestId);
    res.setHeader('cache-control', 'no-store');
    const start = Date.now();
    res.on('finish', () =>
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'http_request',
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
    );
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      sendError(
        new AppError('ORIGIN_NOT_ALLOWED', 403, 'Origin is not allowed.'),
        req,
        res,
      );
      return;
    }
    next();
  });
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['x-request-id', 'Retry-After'],
  });
  app.use(async (request: Request, res: Response, next: NextFunction) => {
    const req = request as AppRequest;
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    if (req.method === 'OPTIONS' || !path.startsWith('/api/')) {
      next();
      return;
    }
    const auth = [
      '/api/auth/login',
      '/api/auth/signup',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
    ].includes(path);
    try {
      const result = await store.consume(
        `${req.ip ?? req.socket.remoteAddress ?? 'unknown'}:${auth ? 'auth' : 'api'}`,
        auth ? config.AUTH_RATE_LIMIT : config.API_RATE_LIMIT,
        config.RATE_WINDOW_SECONDS * 1000,
      );
      if (!result.allowed) {
        res.setHeader('retry-after', String(result.retryAfter));
        sendError(
          new AppError(
            'RATE_LIMITED',
            429,
            'Too many requests. Please try again later.',
          ),
          req,
          res,
        );
        return;
      }
      next();
    } catch (error: unknown) {
      next(error);
    }
  });
  app.use(cookieParser());
  app.use(json({ limit: '32kb' }));
  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!error) {
      next();
      return;
    }
    const type =
      typeof error === 'object' && error !== null && 'type' in error
        ? (error as { type: unknown }).type
        : undefined;
    const controlled =
      type === 'entity.too.large'
        ? new AppError('PAYLOAD_TOO_LARGE', 413, 'Request body is too large.')
        : type === 'entity.parse.failed'
          ? new AppError(
              'INVALID_JSON',
              400,
              'Request body must be valid JSON.',
            )
          : error;
    sendError(controlled, req as AppRequest, res);
  });
  app.useGlobalFilters(new AppExceptionFilter());
}
