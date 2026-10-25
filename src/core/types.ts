import type { Request } from 'express';
export interface SessionUser {
  id: number;
  employeeId: number;
  departmentId: number;
  email: string;
  name: string;
  role: 'admin' | 'member';
}
export interface AppRequest extends Request {
  requestId: string;
  user?: SessionUser;
}
