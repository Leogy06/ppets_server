import z from 'zod';
import { createZodDto } from 'nestjs-zod';

export const createItemSchema = z.object({
  //ID: number; no need na
  ITEM_NAME: z.string().min(1, 'Item name is required.'),
  DESCRIPTION: z.string().min(1, 'Description is required'),
  UNIT_VALUE: z.number().nonnegative(),
  QUANTITY: z.number().nonnegative(),
  // DEPARTMENT_ID: z.number().nonnegative(), no need to validate here, we just put dep id in the backend base on token decoded
  RECEIVED_AT: z.string().min(1, 'Received item date is required.'),

  //this are optional but only of them should have a value
  PIS_NO: z.string().optional(),
  PROP_NO: z.string().optional(),
  MR_NO: z.string().optional(),
  ICS_NO: z.string().optional(),
  SERIAL_NO: z.string().optional(),

  ACCOUNT_CODE: z.number().nonnegative(), // account code id FOREIGN KEY
  // ADDED_BY: z.number(), // EMPLOYEE ID FOREIGN KEY
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class CreateItemDto extends createZodDto(createItemSchema) {}
