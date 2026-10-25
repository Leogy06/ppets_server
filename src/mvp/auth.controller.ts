import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG } from '../core/tokens';
import type { AppConfig } from '../core/config';
import type { AppRequest } from '../core/types';
import { Policy } from '../core/policy';
import { parseRequest } from '../core/validation';
import { AuthService } from './auth.service';
const email = z.string().trim().toLowerCase().pipe(z.email().max(255));
const password = z
  .string()
  .min(12)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72);
const token = z.string().regex(/^[a-f0-9]{64}$/);
export const SESSION_COOKIE = 'ppets_session';
function cookie(req: AppRequest): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[SESSION_COOKIE];
  return typeof value === 'string' ? value : undefined;
}
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}
  private cookieOptions() {
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: this.config.NODE_ENV === 'production',
    };
  }
  @Post('signup')
  @Policy('public')
  @HttpCode(202)
  signup(@Req() req: AppRequest) {
    const { body } = parseRequest(
      req,
      z
        .object({ name: z.string().trim().min(1).max(120), email, password })
        .strict(),
    );
    return this.auth.signup(body);
  }
  @Post('verify-email')
  @Policy('public')
  @HttpCode(200)
  verify(@Req() req: AppRequest) {
    const { body } = parseRequest(req, z.object({ token }).strict());
    return this.auth.verify(body.token);
  }
  @Post('login')
  @Policy('public')
  @HttpCode(200)
  async login(
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body } = parseRequest(req, z.object({ email, password }).strict());
    const result = await this.auth.login(body, cookie(req));
    res.cookie(SESSION_COOKIE, result.token, {
      ...this.cookieOptions(),
      maxAge: this.config.SESSION_TTL_HOURS * 60 * 60_000,
    });
    return { user: result.user };
  }
  @Post('logout')
  @Policy('public')
  @HttpCode(200)
  async logout(
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    parseRequest(req);
    await this.auth.logout(cookie(req));
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { message: 'Signed out.' };
  }
  @Get('session')
  @Policy('session:read')
  session(@Req() req: AppRequest) {
    parseRequest(req);
    return { user: req.user };
  }
  @Post('forgot-password')
  @Policy('public')
  @HttpCode(200)
  forgot(@Req() req: AppRequest) {
    const { body } = parseRequest(req, z.object({ email }).strict());
    return this.auth.forgotPassword(body.email);
  }
  @Post('reset-password')
  @Policy('public')
  @HttpCode(200)
  reset(@Req() req: AppRequest) {
    const { body } = parseRequest(req, z.object({ token, password }).strict());
    return this.auth.resetPassword(body.token, body.password);
  }
}
