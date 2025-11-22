import { Body, Controller, Post } from '@nestjs/common';
import { TransactionConcernService } from './transaction_concern.service';
import { CreateTransactionConcernDto } from 'src/schemas/transactionConcern.schema';

@Controller('api/transaction-concern')
export class TransactionConcernController {
  constructor(private readonly service: TransactionConcernService) {}

  @Post()
  async create(@Body() dto: CreateTransactionConcernDto) {
    return this.service.create(dto);
  }
}
