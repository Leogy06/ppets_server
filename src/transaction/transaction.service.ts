import { Injectable, NotFoundException } from '@nestjs/common';
import e from 'express';
import { DatabaseService } from 'src/database/database.service';
import { CreateTransactionDto } from 'src/schemas/transaction.schema';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: DatabaseService) {}

  async createTransaction(createTransactionDto: CreateTransactionDto) {
    const [item, employee] = await Promise.all([
      await this.prisma.items.findUnique({
        where: { ID: createTransactionDto.itemId },
      }),
      await this.prisma.employee.findUnique({
        where: { ID: createTransactionDto.employeeId },
      }),
    ]);

    if (!item) throw new NotFoundException('Item not found.');

    if (!employee) throw new NotFoundException('Employee not found.');

    const newTransaction = await this.prisma.transaction.create({
      data: createTransactionDto,
    });

    return newTransaction;
  }
  async getTransaction(employeeId: number) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        ID: employeeId,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    return await this.prisma.transaction.findMany({
      where: {
        employee: {
          DEPARTMENT_ID: employee.DEPARTMENT_ID,
        },
      },
    });
  }
}
