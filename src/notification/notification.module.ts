import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';

@Module({
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService],
  controllers: [NotificationController],
})
export class NotificationModule {}
