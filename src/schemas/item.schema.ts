import z from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Condition } from '@prisma/client';

export const createItemSchema = z
  .object({
    ID: z.number().optional(), //to reveal id in the frontend
    ITEM_NAME: z.string().min(1, 'Item name is required.'),
    DESCRIPTION: z.string().min(1, 'Description is required'),
    UNIT_VALUE: z
      .number()
      .nonnegative('Unit value of the item should not be negative.')
      .min(1, 'Unit value is required'),
    QUANTITY: z
      .number()
      .nonnegative('Quantity of the item should not be negative.'),
    // DEPARTMENT_ID: z.number().nonnegative(), no need to validate here, we just put dep id in the backend base on token decoded
    RECEIVED_AT: z.string().min(1, 'Received item date is required.'),

    //this are optional but only of them should have a value
    PIS_NO: z.string().optional(),
    PROP_NO: z.string().optional(),
    MR_NO: z.string().optional(),
    ICS_NO: z.string().optional(),
    SERIAL_NO: z.string().optional(),
    PAR_NO: z.string().optional(),

    ACCOUNT_CODE: z.number().nonnegative(), // account code id FOREIGN KEY
    // ADDED_BY: z.number(), // EMPLOYEE ID FOREIGN KEY
    createdAt: z.string(),
    updatedAt: z.string(),

    REMARKS: z.string().optional(),
    DELETE: z.number().nonnegative().optional(),
  })
  .strict();

export class CreateItemDto extends createZodDto(createItemSchema) {}

export const updateItemSchema = createItemSchema
  .partial()
  .extend({
    condition: z.enum(Condition).optional(),
    ID: z.number().nonnegative().optional(),
  })
  .strict();

export class UpdateItemDto extends createZodDto(updateItemSchema) {}
