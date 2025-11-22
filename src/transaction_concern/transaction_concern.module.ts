import { Module } from '@nestjs/common';
import { TransactionConcernController } from './transaction_concern.controller';
import { TransactionConcernService } from './transaction_concern.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TransactionConcernController],
  providers: [TransactionConcernService],
})
export class TransactionConcernModule {}
