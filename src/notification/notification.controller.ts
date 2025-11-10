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
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ExtendRequest } from 'src/user/dto/create-user.dto';

@Controller('api/notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('/:take')
  async getNotification(
    @Req() req: ExtendRequest,
    @Param('take', ParseIntPipe) take: number,
  ) {
    return this.notificationService.getNotification(req.user.employeeId, take);
  }

  @Put('read')
  async updateNotification(@Body('ids') ids: string[]) {
    return await this.notificationService.readNotifications(ids);
  }
}
