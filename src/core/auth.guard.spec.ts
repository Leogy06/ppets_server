import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { AuthService } from '../mvp/auth.service';
import { Policy } from './policy';
import type { AppRequest, SessionUser } from './types';
const member: SessionUser = {
  id: 1,
  employeeId: 8,
  departmentId: 2,
  email: 'member@example.test',
  name: 'Member',
  role: 'member',
};
class TestController {
  @Policy('public') publicRoute() {}
  @Policy('session:read') profile() {}
  @Policy('requests:approve') approve() {}
  missing() {}
}
function context(
  method: keyof TestController,
  cookies: unknown = {},
): { context: ExecutionContext; request: AppRequest } {
  const request = {
    cookies,
    body: { role: 'admin', employeeId: 999 },
  } as AppRequest;
  return {
    request,
    context: {
      getHandler: () => TestController.prototype[method],
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}
describe('global auth guard', () => {
  const authenticate = jest.fn<Promise<SessionUser | null>, [string?]>();
  let guard: AuthGuard;
  beforeEach(() => {
    authenticate.mockReset();
    guard = new AuthGuard(new Reflector(), {
      authenticate,
    } as unknown as AuthService);
  });
  it('permits explicitly public routes without session lookup', async () => {
    expect(await guard.canActivate(context('publicRoute').context)).toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('fails closed when metadata is missing', async () => {
    await expect(
      guard.canActivate(context('missing').context),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('requires valid server session and ignores client identity', async () => {
    authenticate.mockResolvedValue(member);
    const input = context('profile', { ppets_session: 'trusted-token' });
    expect(await guard.canActivate(input.context)).toBe(true);
    expect(authenticate).toHaveBeenCalledWith('trusted-token');
    expect(input.request.user).toBe(member);
  });
  it('rejects absent and malformed cookie credentials', async () => {
    authenticate.mockResolvedValue(null);
    for (const cookies of [{}, { ppets_session: ['invalid'] }])
      await expect(
        guard.canActivate(context('profile', cookies).context),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(authenticate).toHaveBeenLastCalledWith(undefined);
  });
  it('denies member approval and permits administrator approval', async () => {
    authenticate.mockResolvedValue(member);
    await expect(
      guard.canActivate(context('approve').context),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    authenticate.mockResolvedValue({ ...member, role: 'admin' });
    expect(await guard.canActivate(context('approve').context)).toBe(true);
  });
});
