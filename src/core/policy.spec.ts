import { can } from './policy';
import type { SessionUser } from './types';
const member: SessionUser = {
  id: 1,
  employeeId: 8,
  departmentId: 2,
  email: 'member@example.test',
  name: 'Member',
  role: 'member',
};
const admin: SessionUser = { ...member, role: 'admin' };
describe('authorization policy', () => {
  it('allows public access and denies every protected action without a session', () => {
    expect(can(null, 'public')).toBe(true);
    for (const action of [
      'session:read',
      'assets:read',
      'requests:list',
      'requests:create',
      'requests:approve',
      'requests:reject',
      'requests:cancel',
      'requests:return',
    ] as const)
      expect(can(undefined, action)).toBe(false);
  });
  it('allows authenticated reads and reserves approval for admin', () => {
    for (const user of [member, admin])
      for (const action of [
        'session:read',
        'assets:read',
        'requests:list',
      ] as const)
        expect(can(user, action)).toBe(true);
    expect(can(member, 'requests:approve')).toBe(false);
    expect(can(admin, 'requests:approve')).toBe(true);
    expect(can(admin, 'requests:create')).toBe(false);
    expect(can(member, 'requests:create')).toBe(true);
  });
  it('allows returns only by the member owning the resource', () => {
    expect(can(member, 'requests:return')).toBe(true);
    expect(can(member, 'requests:return', { ownerId: 8 })).toBe(true);
    expect(can(member, 'requests:return', { ownerId: 9 })).toBe(false);
    expect(can(admin, 'requests:return', { ownerId: 8 })).toBe(false);
    expect(can(member, 'unsupported' as 'public')).toBe(false);
  });
  it('reserves rejection for admins and cancellation for the owning member', () => {
    expect(can(member, 'requests:reject')).toBe(false);
    expect(can(admin, 'requests:reject')).toBe(true);
    expect(can(member, 'requests:cancel', { ownerId: 8 })).toBe(true);
    expect(can(member, 'requests:cancel', { ownerId: 9 })).toBe(false);
    expect(can(admin, 'requests:cancel', { ownerId: 8 })).toBe(false);
  });
});
