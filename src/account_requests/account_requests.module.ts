import { Module } from '@nestjs/common';
import { AccountRequestsController } from './account_requests.controller';
import { AccountRequestsService } from './account_requests.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AccountRequestsController],
  providers: [AccountRequestsService],
})
export class AccountRequestsModule {}
