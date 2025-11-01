import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AccountRequestsService {
  constructor(private readonly prisma: DatabaseService) {}

  async create(createAccountRequestDto: any) {
    return await this.prisma.account_request.create({
      data: createAccountRequestDto,
    });
  }
}
