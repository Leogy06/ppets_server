import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { DatabaseService } from 'src/database/database.service';
import { CreateItemDto } from 'src/schemas/item.schema';

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

  async create(createUserDto: CreateItemDto, req: Request) {
    //check if srn exist
    if (createUserDto?.SERIAL_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          SERIAL_NO: createUserDto.SERIAL_NO,
        },
      });

      if (exist) throw new BadRequestException('Serial number already exist.');
    }

    //check if ICS exist
    if (createUserDto?.ICS_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          ICS_NO: createUserDto.ICS_NO,
        },
      });

      if (exist) throw new BadRequestException('ICS number already exist.');
    }

    //check pis number exist
    if (createUserDto?.PIS_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          PIS_NO: createUserDto.PIS_NO,
        },
      });

      if (exist) throw new BadRequestException('PIS number already exist.');
    }

    //check prop number exist
    if (createUserDto?.PROP_NO) {
      const exist = await this.prisma.items.findFirst({
        where: {
          PROP_NO: createUserDto.PROP_NO,
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
        ...createUserDto,
        DEPARTMENT_ID: findEmployee.DEPARTMENT_ID,
        ADDED_BY: findEmployee.ID,
      },
    });

    return newItem;
  }
}
