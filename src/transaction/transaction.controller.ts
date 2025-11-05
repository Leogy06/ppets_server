import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateTransactionDto } from 'src/schemas/transaction.schema';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';
import { Status } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('api/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  //create transaction
  @Post()
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: ExtendRequest,
  ) {
    const { employeeId } = req.user;
    return await this.transactionService.createTransaction(
      createTransactionDto,
      employeeId,
    );
  }

  @Get(':pageSize/:pageIndex')
  async getTransaction(
    @Param('pageSize', ParseIntPipe) pageSize: number,
    @Param('pageIndex', ParseIntPipe) pageIndex: number,
    @Req() req: ExtendRequest,
  ) {
    const employeeId = req.user.employeeId;
    return await this.transactionService.getTransaction(
      employeeId,
      pageSize,
      pageIndex,
    );
  }

  @Put('update-status/:transactionId')
  async updateTransactionStatus(
    @Param('transactionId') transactionId: string,
    @Req() req: ExtendRequest,
    @Body('status') status: Status,
  ) {
    return await this.transactionService.updateStatus(
      status,
      transactionId,
      req,
    );
  }
}
