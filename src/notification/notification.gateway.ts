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

      const { employeeId, role } = decoded;

      let department: number | null = null;

      if (employeeId) {
        const employee = await this.prisma.employee.findUnique({
          where: {
            ID: employeeId,
          },
        });

        department = employee?.CURRENT_DPT_ID || null;
      }

      //join role & department rooms
      if (role) client.join(`role:${role}`);
      if (department) client.join(`Department:${department}`);

      console.log(
        `⚡ Client ${client.id} joined role: ${roleIdConvert(role)} Department: ${convertDepartmentId(department)}`,
      );
    } catch (error) {
      console.error('❌ Connection error:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  sendNotification(payload: { message: string }) {
    this.server.emit('notification', payload);
  }

  @SubscribeMessage('send_admin_notif')
  handleSendAdminNotif(
    @MessageBody() data: { notification: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`Received from client ${client.id}: `, data);
    this.server.to(`role:1`).to('department:1').emit('admin_notif', data);
  }
}
