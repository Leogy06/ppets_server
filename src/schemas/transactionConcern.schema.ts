import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const createTransactionConcernSchema = z.object({
  transactionId: z.string().min(1, 'Transaction Id is required. '),
  message: z.string().min(1, 'Message is required. '),
});

export class CreateTransactionConcernDto extends createZodDto(
  createTransactionConcernSchema,
) {}
1;
