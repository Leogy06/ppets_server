import { Status } from '@prisma/client';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createTransactionSchema = z.object({
  id: z.string().optional(),
  // employeeId: z.number().min(1, 'Employee ID is required.'), this can now get in the req object
  itemId: z.number().min(1, 'Item ID is required.'),
  quantity: z
    .number()
    .int('Value should not decimal.')
    .min(1, 'Quantity is required and it should be non-negative.'),
  reason: z
    .string()
    .min(1, 'You should have a reason to start this transaction.'),
});

export class CreateTransactionDto extends createZodDto(
  createTransactionSchema,
) {}
