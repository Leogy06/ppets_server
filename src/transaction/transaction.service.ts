import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Status } from '@prisma/client';
import e from 'express';
import { DatabaseService } from 'src/database/database.service';
import { NotificationService } from 'src/notification/notification.service';
import { CreateTransactionDto } from 'src/schemas/transaction.schema';
import { ExtendRequest } from 'src/user/dto/create-user.dto';
import { employeeName } from 'src/utils/employee-utils';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly notificationService: NotificationService,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
    employeeId: number, //creator of the transaction
  ) {
    const [item, employee, empHasPendingTransaction] = await Promise.all([
      await this.prisma.items.findUnique({
        where: { ID: createTransactionDto.itemId },
      }),
      await this.prisma.employee.findUnique({
        where: { ID: employeeId },
      }),

      //check if the requestor has pending transactions
      await this.prisma.transaction.findFirst({
        where: {
          status: 'PENDING',
          employeeId,
        },
      }),
    ]);

    if (!item) throw new NotFoundException('Item not found.');

    if (!employee) throw new NotFoundException('Employee not found.');

    const empAdmin = await this.prisma.users.findFirst({
      where: {
        role: 1,
        employee: {
          CURRENT_DPT_ID: employee.CURRENT_DPT_ID,
        },
      },
    });

    if (!empAdmin) throw new NotFoundException('Admin not found.');

    //check if employee still has pending transaction
    if (empHasPendingTransaction)
      throw new BadRequestException(
        'You have a previous transaction. Please settle first.',
      );

    const newTransaction = await this.prisma.transaction.create({
      data: { ...createTransactionDto, employeeId },
    });

    // create anotification about the created transaction
    this.notificationService.notifyAdmin(
      `${employeeName(employee)} has requested ${item.ITEM_NAME}`, // the message
      empAdmin.emp_id,
    );

    return newTransaction;
  }

  //use by admin to get transactions
  async getTransaction(
    employeeId: number,
    pageSize: number,
    pageIndex: number,
  ) {
    const skip = pageSize * (pageIndex - 1);

    const employee = await this.prisma.employee.findUnique({
      where: {
        ID: employeeId,
      },
    });

    if (!employee) throw new NotFoundException('Employee not found.');

    const count = await this.prisma.transaction.count({
      where: {
        employee: {
          DEPARTMENT_ID: employee.DEPARTMENT_ID,
        },
      },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        employee: {
          DEPARTMENT_ID: employee.DEPARTMENT_ID,
        },
      },
      include: {
        item: {
          select: {
            ITEM_NAME: true,
            DESCRIPTION: true,
            UNIT_VALUE: true,
          },
        },
        employee: {
          select: {
            FIRSTNAME: true,
            LASTNAME: true,
            MIDDLENAME: true,
            SUFFIX: true,
          },
        },
      },

      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

    return { transactions, count };
  }

  async updateStatus(
    status: Status,
    transactionId: string,
    req: ExtendRequest,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) throw new NotFoundException('Transaction not found.');
    if (transaction.status !== Status.PENDING)
      throw new BadRequestException('Status is not pending anymore.');

    return await this.prisma.transaction.update({
      where: {
        id: transactionId,
      },
      data: {
        status,
        updatedAt: new Date(),
        updatedBy: req.user.userId,
      },
    });
  }

  //get transaction of an employee
  async getEmployeeApprovedTransaction(employeeId: number) {
    return await this.prisma.transaction.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
      },
      select: {
        id: true,
        item: true,
        itemId: true,
        quantity: true,
      },
    });
  }
}
