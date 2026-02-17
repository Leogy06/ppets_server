import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from 'src/generated/client/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
