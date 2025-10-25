import type { Request } from 'express';

// create-user.dto.ts
export class CreateUserDto {
  username: string;
  password: string;
  email: string;
  role: number;
  is_active: number;
  DEPARTMEN_USER: number;
  emp_id: number;
}

export class ExtendRequest extends Request {
  user: {
    employeeId: number;
  };
}
