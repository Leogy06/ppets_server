import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

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
  handleConnection(client: Socket) {
    console.log(`⚡ Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`❌ Client disconnected: ${client.id}`);
  }

  sendNotification(payload: { message: string }) {
    this.server.emit('notification', payload);
  }
}
