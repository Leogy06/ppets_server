import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Status } from 'src/dto';
import { CreateTransactionConcernDto } from 'src/schemas/transactionConcern.schema';

@Injectable()
export class TransactionConcernService {
  constructor(private readonly prisma: DatabaseService) {}

  async create(dto: CreateTransactionConcernDto) {
    const transaction = await this.prisma.transactions.findUnique({
      where: {
        id: dto.transactionId,
      },
    });

    if (!transaction) throw new NotFoundException('Transaction not found.');

    return await this.prisma.transactionConcerns.create({
      data: { ...dto, intentStatus: Status.PENDING },
    });
  }
}
