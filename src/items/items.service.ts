import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: DatabaseService) {}

  async findAll() {
    const items = await this.prisma.items.findMany({
      where: {
        DELETE: 0,
      },
    });
    return items;
  }
}
