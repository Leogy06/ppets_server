import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateItemDto } from 'src/schemas/item.schema';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: DatabaseService) {}

  async findAll(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;

    const items = await this.prisma.items.findMany({
      where: {
        DELETE: 0,
      },
      skip,
      take: pageSize,
      orderBy: { ITEM_NAME: 'asc' },
    });
    return items;
  }

  async create(createUserDto: CreateItemDto) {
    const newItem = await this.prisma.items.create({
      data: createUserDto,
    });

    return newItem;
  }
}
