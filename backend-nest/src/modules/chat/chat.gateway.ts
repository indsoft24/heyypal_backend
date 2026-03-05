import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { JwtWsGuard } from '../auth/guards/jwt-ws.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets = new Map<number, string>(); // userId -> socketId

  constructor(private readonly chatService: ChatService) { }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    let disconnectedUserId: number | null = null;

    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        disconnectedUserId = userId;
        this.userSockets.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      this.logger.log(`User ${disconnectedUserId} disconnected (${client.id})`);
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('register')
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // In JwtWsGuard, the user is attached to client.user
    const user = (client as any).user;
    if (user && user.userId) {
      this.userSockets.set(Number(user.userId), client.id);
      this.logger.log(`User ${user.userId} registered with socket ${client.id}`);
      return { event: 'registered', data: { success: true } };
    }
  }

  @UseGuards(JwtWsGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = (client as any).user;
    if (!user || !user.userId) {
      this.logger.warn(`Unauthorized sendMessage attempt from ${client.id}`);
      return { event: 'error', data: 'Unauthorized' };
    }

    this.logger.log(`Incoming message from ${user.userId} to ${dto.receiverId}`);

    try {
      const senderId = Number(user.userId);
      const message = await this.chatService.sendMessage(senderId, dto);

      // Send to receiver if online
      const receiverSocketId = this.userSockets.get(dto.receiverId);
      if (receiverSocketId) {
        this.logger.debug(`Broadcasting to receiver ${dto.receiverId} socket ${receiverSocketId}`);
        this.server.to(receiverSocketId).emit('newMessage', message);
      } else {
        this.logger.debug(`Receiver ${dto.receiverId} is offline, notification already sent by service`);
      }

      // Send acknowledgment back to sender
      return { event: 'messageSent', data: message };
    } catch (error) {
      this.logger.error(`Error in handleSendMessage: ${error.message}`, error.stack);
      return { event: 'error', data: error.message || 'Internal server error' };
    }
  }
}
