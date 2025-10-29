import { Injectable } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(private readonly gateway: NotificationGateway) {}

  async notifyAdmin(message: string) {
    this.gateway.sendNotification({ message });
  }
}
