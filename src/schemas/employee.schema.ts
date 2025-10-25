import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const createEmployeeSchema = z
  .object({
    ID_NUMBER: z
      .number()
      .min(1, 'Id number is required and must NOT be negative.'),
    FIRSTNAME: z.string().min(1, 'Firstname is required.'),
    LASTNAME: z.string().min(1, 'Lastname is required.'),
    MIDDLENAME: z.string().optional(),
    SUFFIX: z.string().optional(),
  })
  .strict();

export class CreateEmployeeDto extends createZodDto(createEmployeeSchema) {}
