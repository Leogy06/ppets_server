import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}
