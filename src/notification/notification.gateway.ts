import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DatabaseService } from 'src/database/database.service';
import * as jwt from 'jsonwebtoken'; // for decoding token
import { convertDepartmentId } from 'src/utils/department-utils';
import { roleIdConvert } from 'src/utils/role-utils';
import { Notification } from 'src/dto';
import { BadRequestException } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: [process.env.CLIENT_BASEURL],
    credentialss: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: DatabaseService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        console.log('⚠️ No token provided, disconnecting...');
        client.disconnect();
        return;
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

      if (!decoded) throw new BadRequestException('Token is invalid');

      const { employeeId } = decoded;

      //register to employeeId
      if (employeeId) client.join(`employeeId:${employeeId}`);

      console.log(
        `⚡ Client ${client.id}  joined with employee ID: ${employeeId}`,
      );
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  //employee sends admin a notif about the transaction
  sendNotification(notification: Notification, employeeId: number) {
    this.server
      .to(`employeeId:${employeeId}`)
      .emit('sendNotification', notification);
  }
}
