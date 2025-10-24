import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { NotFoundError } from 'rxjs';
import { DatabaseService } from 'src/database/database.service';
import { CreateItemDto, UpdateItemDto } from 'src/schemas/item.schema';
import { checkDuplicateField } from 'src/utils/duplicate-checker.util';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: DatabaseService) {}

  async findAll(page: number = 1, pageSize: number = 10, itemName?: string) {
    const skip = (page - 1) * pageSize;

    const count = await this.prisma.items.count();

    const items = await this.prisma.items.findMany({
      where: {
        DELETE: 0,
        ...(itemName && itemName.trim() !== ''
          ? {
              ITEM_NAME: {
                contains: itemName,
              },
            }
          : {}),
      },
      skip,
      take: pageSize,
      orderBy: { ITEM_NAME: 'asc' },
    });
    return { items, count };
  }

  async create(createItemDto: CreateItemDto, req: Request) {
    // 👇 run duplicate checks concurrently
    const [pisDup, propDup, mrDup, parDup] = await Promise.all([
      checkDuplicateField(this.prisma, 'items', 'PIS_NO', createItemDto.PIS_NO),
      checkDuplicateField(
        this.prisma,
        'items',
        'PROP_NO',
        createItemDto.PROP_NO,
      ),
      checkDuplicateField(this.prisma, 'items', 'MR_NO', createItemDto.MR_NO),
      checkDuplicateField(this.prisma, 'items', 'PAR_NO', createItemDto.PAR_NO),
    ]);

    // 👇 build custom message if any are duplicated
    const errors: string[] = [];
    if (pisDup) errors.push('PIS number already exists.');
    if (propDup) errors.push('Property number already exists.');
    if (mrDup) errors.push('MR number already exists.');
    if (parDup) errors.push('PAR number already exists.');

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Duplicate fields detected.',
        errors,
      });
    }

    const findEmployee = await this.prisma.employee.findFirst({
      where: {
        ID: (req as any)?.user?.employeeId,
      },
    });

    if (!findEmployee) throw new BadRequestException('Employee not found.');

    const newItem = await this.prisma.items.create({
      data: {
        ...createItemDto,
        DEPARTMENT_ID: findEmployee.DEPARTMENT_ID,
        ADDED_BY: findEmployee.ID,
      },
    });

    return newItem;
  }

  async update(updateItem: UpdateItemDto, itemId: number) {
    //check if item exist
    const findItem = await this.prisma.items.findUnique({
      where: {
        ID: itemId,
      },
      select: {
        ID: true,
      },
    });

    const [pisDup, propDup, mrDup, parDup] = await Promise.all([
      checkDuplicateField(
        this.prisma,
        'items',
        'PIS_NO',
        updateItem.PIS_NO,
        itemId,
      ),
      checkDuplicateField(
        this.prisma,
        'items',
        'PROP_NO',
        updateItem.PROP_NO,
        itemId,
      ),
      checkDuplicateField(
        this.prisma,
        'items',
        'MR_NO',
        updateItem.MR_NO,
        itemId,
      ),
      checkDuplicateField(
        this.prisma,
        'items',
        'PAR_NO',
        updateItem.PAR_NO,
        itemId,
      ),
    ]);

    // 👇 build custom message if any are duplicated
    const errors: string[] = [];
    if (pisDup) errors.push('PIS number already exists.');
    if (propDup) errors.push('Property number already exists.');
    if (mrDup) errors.push('MR number already exists.');
    if (parDup) errors.push('PAR number already exists.');

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Duplicate fields detected.',
        errors,
      });
    }

    if (!findItem) throw new NotFoundException('Item does not exist.');

    const updatedItem = await this.prisma.items.update({
      where: {
        ID: itemId,
      },
      data: {
        ...updateItem,
        updatedAt: new Date(), // current date
      },
    });

    return updatedItem;
  }
}
