import type { Request } from 'express';
import { User } from 'src/dto';

// create-user.dto.ts
export class CreateUserDto extends User {
  password: string;
}

export class ExtendRequest extends Request {
  user: {
    employeeId: number;
    id: number;
    sub: number;
    userId: number;
    role: number;
  };
}
