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
    //check if srn exist
    if (createItemDto?.SERIAL_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          SERIAL_NO: createItemDto.SERIAL_NO,
        },
      });

      if (exist) throw new BadRequestException('Serial number already exist.');
    }

    //check if ICS exist
    if (createItemDto?.ICS_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          ICS_NO: createItemDto.ICS_NO,
        },
      });

      if (exist) throw new BadRequestException('ICS number already exist.');
    }

    //check pis number exist
    if (createItemDto?.PIS_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          PIS_NO: createItemDto.PIS_NO,
        },
      });

      if (exist) throw new BadRequestException('PIS number already exist.');
    }

    //check prop number exist
    if (createItemDto?.PROP_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          PROP_NO: createItemDto.PROP_NO,
        },
      });

      if (exist) throw new BadRequestException('PROP number already exist.');
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
