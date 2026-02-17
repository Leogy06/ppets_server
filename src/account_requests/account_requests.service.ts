import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AccountRequestsService {
  constructor(private readonly prisma: DatabaseService) {}

  async create(createAccountRequestDto: any) {
    return await this.prisma.accountRequest.create({
      data: createAccountRequestDto,
    });
  }
}
