import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { DatabaseService } from 'src/database/database.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { ConnectedSocket, SubscribeMessage } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Notification } from 'src/dto';

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

    const all = [...unread, ...recent].filter((n) => {
      if (set.has(n.id)) return false;
      set.add(n.id);
      return true;
    });

    return all;
  }

  async notifyAdmin(message: string, adminId: number) {
    //create notification
    const createdNotification = await this.prisma.notification.create({
      data: {
        message,
        empId: adminId,
      },
    });

    this.notificationGateway.sendAdminNotification(
      createdNotification,
      adminId,
    );
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
