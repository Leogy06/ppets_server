import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateTransactionDto } from 'src/schemas/transaction.schema';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  //create transaction
  @Post()
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return await this.transactionService.createTransaction(
      createTransactionDto,
    );
  }

  @Get(':pageSize/:pageIndex')
  async getTransaction(
    @Param('pageSize', ParseIntPipe) pageSize,
    @Param('pageIndex', ParseIntPipe) pageIndex,
    @Req() req: ExtendRequest,
  ) {
    const employeeId = req.user.employeeId;
    return await this.transactionService.getTransaction(
      employeeId,
      pageSize,
      pageIndex,
    );
  }
}
