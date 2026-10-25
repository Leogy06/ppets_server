import { SetMetadata } from '@nestjs/common';
import type { SessionUser } from './types';
export const POLICY_KEY = 'ppets:policy';
export type Action =
  | 'public'
  | 'session:read'
  | 'assets:read'
  | 'requests:list'
  | 'requests:create'
  | 'requests:approve'
  | 'requests:reject'
  | 'requests:cancel'
  | 'requests:return';
export const Policy = (action: Action): MethodDecorator & ClassDecorator =>
  SetMetadata(POLICY_KEY, action);
export function can(
  user: SessionUser | null | undefined,
  action: Action,
  resource?: { ownerId?: number },
): boolean {
  if (action === 'public') return true;
  if (!user || !['admin', 'member'].includes(user.role)) return false;
  switch (action) {
    case 'session:read':
    case 'assets:read':
    case 'requests:list':
      return true;
    case 'requests:create':
      return user.role === 'member';
    case 'requests:approve':
    case 'requests:reject':
      return user.role === 'admin';
    case 'requests:return':
    case 'requests:cancel':
      return (
        user.role === 'member' &&
        (resource?.ownerId === undefined ||
          resource.ownerId === user.employeeId)
      );
    default:
      return false;
  }
}
