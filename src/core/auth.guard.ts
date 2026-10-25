import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../mvp/auth.service';
import { AppError } from './app-error';
import { can, POLICY_KEY } from './policy';
import type { Action } from './policy';
import type { AppRequest } from './types';
@Injectable()
export class AuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<Action | undefined>(
      POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!action) throw new AppError('FORBIDDEN', 403, 'Access is not allowed.');
    if (action === 'public') return true;
    const request = context.switchToHttp().getRequest<AppRequest>();
    const cookies = request.cookies as unknown;
    const token =
      typeof cookies === 'object' &&
      cookies !== null &&
      'ppets_session' in cookies &&
      typeof (cookies as { ppets_session: unknown }).ppets_session === 'string'
        ? (cookies as { ppets_session: string }).ppets_session
        : undefined;
    const user = await this.auth.authenticate(token);
    if (!user)
      throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
    request.user = user;
    if (!can(user, action))
      throw new AppError('FORBIDDEN', 403, 'Access is not allowed.');
    return true;
  }
}
