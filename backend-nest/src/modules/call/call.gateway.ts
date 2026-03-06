import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CallSessionService } from './call-session.service';
import { CallService } from './call.service';
import { RtcService } from './rtc.service';

interface AuthenticatedSocket extends Socket {
  data: { userId?: string };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/call',
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallGateway.name);
  private readonly userSockets = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly callSessionService: CallSessionService,
    @Inject(forwardRef(() => CallService))
    private readonly callService: CallService,
    private readonly rtcService: RtcService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
      this.logger.warn(`Socket connection rejected: no token (socket=${client.id})`);
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'change-me',
      });
      const rawSub = payload.sub;
      const userId = typeof rawSub === 'number' ? rawSub : parseInt(String(rawSub), 10);
      if (Number.isNaN(userId)) {
        this.logger.warn(`Socket connection rejected: invalid sub (socket=${client.id})`);
        client.disconnect();
        return;
      }
      client.data.userId = String(userId);
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      this.logger.log(`Socket connected: user=${userId} socket=${client.id} transport=${client.conn.transport.name}`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${(err as Error).message} (socket=${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      const set = this.userSockets.get(parseInt(userId, 10));
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.userSockets.delete(parseInt(userId, 10));
      }
      this.logger.log(`Socket disconnected: user=${userId} socket=${client.id}`);
    }
  }

  /** Emit event to all sockets for a user (e.g. call:timeout, call:accept). Used by CallService. */
  emitToUser(userId: number, event: string, data: object): void {
    const socketIds = this.getSocketIdsForUser(userId);
    if (socketIds.length > 0) {
      this.server.to(socketIds).emit(event, data);
    }
  }

  private getSocketIdsForUser(userId: number): string[] {
    const set = this.userSockets.get(userId);
    return set ? Array.from(set) : [];
  }

  @SubscribeMessage('call:initiate')
  async handleInitiate(
    @MessageBody() body: { receiverId: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const callerId = parseInt(client.data.userId!, 10);
    const receiverId = body?.receiverId;
    if (receiverId == null) return;

    const { busy, result } = await this.callService.initiate(callerId, receiverId);
    if (busy) {
      this.server.to(client.id).emit('call:busy', { receiverId });
      return;
    }
    this.server.to(client.id).emit('call:initiate_ok', result);
  }

  @SubscribeMessage('call:accept')
  async handleAccept(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const receiverId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;

    const acceptResult = await this.callService.accept(receiverId, callSessionId);
    if (!acceptResult.ok || !acceptResult.result) return;
    this.server.to(client.id).emit('call:accept_ok', acceptResult.result);
  }

  @SubscribeMessage('call:reject')
  async handleReject(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const receiverId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;
    await this.callService.reject(receiverId, callSessionId);
  }

  @SubscribeMessage('call:end')
  async handleEnd(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;
    await this.callService.end(userId, callSessionId);
  }

  @SubscribeMessage('call:offer')
  async handleOffer(
    @MessageBody() body: { callSessionId: string; offer: Record<string, unknown> },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = parseInt(client.data.userId!, 10);
    const { callSessionId, offer } = body;
    if (!callSessionId || !offer) return;

    const ok = await this.rtcService.saveOffer(callSessionId, offer);
    if (!ok) return;

    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session) return;
    const peerId = session.callerId === userId ? session.receiverId : session.callerId;
    this.server.to(this.getSocketIdsForUser(peerId)).emit('call:offer', { callSessionId, offer });
  }

  @SubscribeMessage('call:answer')
  async handleAnswer(
    @MessageBody() body: { callSessionId: string; answer: Record<string, unknown> },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = parseInt(client.data.userId!, 10);
    const { callSessionId, answer } = body;
    if (!callSessionId || !answer) return;

    const ok = await this.rtcService.saveAnswer(callSessionId, answer);
    if (!ok) return;

    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session) return;
    const peerId = session.callerId === userId ? session.receiverId : session.callerId;
    this.server.to(this.getSocketIdsForUser(peerId)).emit('call:answer', { callSessionId, answer });
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @MessageBody()
    body: { callSessionId: string; candidate: Record<string, unknown> },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = parseInt(client.data.userId!, 10);
    const { callSessionId, candidate } = body;
    if (!callSessionId || !candidate) return;

    await this.rtcService.addIceCandidate(callSessionId, userId, candidate);

    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session) return;
    const peerId = session.callerId === userId ? session.receiverId : session.callerId;
    this.server
      .to(this.getSocketIdsForUser(peerId))
      .emit('call:ice-candidate', { callSessionId, candidate, from: userId });
  }
}
