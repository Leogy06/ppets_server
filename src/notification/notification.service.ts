import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { DatabaseService } from 'src/database/database.service';
import { Employee, Items, User } from 'src/dto';
import { employeeName } from 'src/utils/employee-utils';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async getNotification(empId: number, take = 5) {
    if (!empId) throw new BadRequestException('Employee ID is required.');

    const [unread, recent] = await Promise.all([
      await this.prisma.notification.findMany({
        where: {
          empId,
          read: 'UNREAD',
        },
      }),
      await this.prisma.notification.findMany({
        where: {
          empId,
        },
        take,
        orderBy: { createadAt: 'desc' },
      }),
    ]);

    const set = new Set();

    //unread should be on top
    //while read is below if in the page size(take)
    const all = [...unread, ...recent].filter((n) => {
      if (set.has(n.id)) return false;
      set.add(n.id);
      return true;
    });

    return all;
  }

  async notifyAdmin(
    employee: Employee,
    admin: Pick<User, 'emp_id' | 'id'>,
    itemName: string,
  ) {
    //create notification
    const employeeNotif = await this.prisma.notification.create({
      data: {
        message: `You have requested ${itemName}`,
        empId: employee.ID,
      },
    });

    //create notification for the admin
    const adminNotif = await this.prisma.notification.create({
      data: {
        message: `${employeeName(employee)} requested ${itemName}`,
        empId: admin.emp_id,
      },
    });

    //for the admin notif
    employee.CURRENT_DPT_ID &&
      this.notificationGateway.sendNotification(adminNotif, admin.emp_id);

    //for the employee notif
    employee.CURRENT_DPT_ID &&
      this.notificationGateway.sendNotification(employeeNotif, employee.ID);
  }

  async approveRequestNotification(
    employee: Employee,
    admin: Pick<User, 'emp_id' | 'id'>,
    itemName: string,
  ) {
    if (!employee || !admin || !itemName)
      throw new BadRequestException('Required fieds are empty.');

    const empNotif = await this.prisma.notification.create({
      data: {
        message: `You're request for the item ${itemName} has been approved.`,
        empId: employee.ID,
      },
    });

    const adminNotif = await this.prisma.notification.create({
      data: {
        message: `The requested item ${itemName} by ${employeeName(employee)} has been approved.`,
        empId: admin.emp_id,
      },
    });

    this.notificationGateway.sendNotification(adminNotif, admin.emp_id);

    this.notificationGateway.sendNotification(empNotif, employee.ID);
  }

  //unread multiple notification
  async readNotifications(ids: string[]) {
    if (!ids.length)
      return {
        updated: 0,
      };

    const readNotification = await this.prisma.notification.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        read: 'READ',
        readAt: new Date(),
      },
    });

    return {
      readNotification,
    };
  }
}
