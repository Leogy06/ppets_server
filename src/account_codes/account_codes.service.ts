import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AccountCodesService {
  constructor(private readonly prisma: DatabaseService) {}

  //get all account codes
  async findAll() {
    return await this.prisma.account_item_tbl.findMany();
  }
}
