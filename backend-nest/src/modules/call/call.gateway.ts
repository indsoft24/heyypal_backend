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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CallSessionService } from './call-session.service';
import { CallLogService } from './call-log.service';
import { PresenceService } from './presence.service';
import { RtcService } from './rtc.service';
import { CallLog, CallStatus } from './entities/call-log.entity';
import { CallSessionStatus } from './schemas/call-session.schema';

const CALL_RING_TIMEOUT_MS = 30_000;

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
  private ringTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly callSessionService: CallSessionService,
    private readonly callLogService: CallLogService,
    private readonly presenceService: PresenceService,
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

  private getSocketIdsForUser(userId: number): string[] {
    const set = this.userSockets.get(userId);
    return set ? Array.from(set) : [];
  }

  private clearRingTimeout(callSessionId: string) {
    const t = this.ringTimeouts.get(callSessionId);
    if (t) {
      clearTimeout(t);
      this.ringTimeouts.delete(callSessionId);
    }
  }

  @SubscribeMessage('call:initiate')
  async handleInitiate(
    @MessageBody()
    body: { receiverId: number },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const callerId = parseInt(client.data.userId!, 10);
    const receiverId = body?.receiverId;
    if (receiverId == null) return;

    const inCall = await this.presenceService.isUserInCall(receiverId);
    if (inCall) {
      this.server.to(client.id).emit('call:busy', { receiverId });
      return;
    }

    const session = await this.callSessionService.create({
      callerId,
      receiverId,
    });
    const sid = session.callSessionId;
    await this.callSessionService.setRinging(sid);

    await this.callLogService.create({
      callSessionId: sid,
      callerId,
      receiverId,
      callStatus: CallStatus.RINGING,
      callType: 'audio',
      missedFlag: false,
    });

    const receiverSockets = this.getSocketIdsForUser(receiverId);
    if (receiverSockets.length > 0) {
      this.server.to(receiverSockets).emit('call:ringing', {
        callSessionId: sid,
        callerId,
      });
    }

    this.server.to(client.id).emit('call:ringing', {
      callSessionId: sid,
      callerId,
    });

    this.ringTimeouts.set(
      sid,
      setTimeout(() => this.handleRingTimeout(sid), CALL_RING_TIMEOUT_MS),
    );
  }

  private async handleRingTimeout(callSessionId: string) {
    this.ringTimeouts.delete(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.callStatus !== CallSessionStatus.RINGING) return;

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.TIMEOUT);
    await this.callSessionService.deleteBySessionId(callSessionId);

    const log = await this.callLogService.findBySessionId(callSessionId);
    if (log) {
      await this.callLogService.updateEnd(
        callSessionId,
        new Date(),
        CallStatus.MISSED,
        0,
        true,
      );
    }

    this.server.to(this.getSocketIdsForUser(session.callerId)).emit('call:timeout', { callSessionId });
    this.server.to(this.getSocketIdsForUser(session.receiverId)).emit('call:timeout', { callSessionId });
  }

  @SubscribeMessage('call:accept')
  async handleAccept(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const receiverId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;

    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.receiverId !== receiverId) return;
    if (session.callStatus !== CallSessionStatus.RINGING) return;

    await this.callSessionService.setConnected(callSessionId, [
      session.callerId,
      session.receiverId,
    ]);

    const callerSockets = this.getSocketIdsForUser(session.callerId);
    this.server.to(callerSockets).emit('call:accept', {
      callSessionId,
      acceptedBy: receiverId,
    });
    this.server.to(client.id).emit('call:accept', {
      callSessionId,
      acceptedBy: receiverId,
    });
  }

  @SubscribeMessage('call:reject')
  async handleReject(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const receiverId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;

    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.receiverId !== receiverId) return;

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.REJECTED);
    await this.callLogService.updateEnd(
      callSessionId,
      new Date(),
      CallStatus.REJECTED,
      0,
    );
    await this.callSessionService.deleteBySessionId(callSessionId);

    const callerSockets = this.getSocketIdsForUser(session.callerId);
    this.server.to(callerSockets).emit('call:reject', { callSessionId, rejectedBy: receiverId });
    this.server.to(client.id).emit('call:reject', { callSessionId, rejectedBy: receiverId });
  }

  @SubscribeMessage('call:end')
  async handleEnd(
    @MessageBody() body: { callSessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const userId = parseInt(client.data.userId!, 10);
    const { callSessionId } = body;
    if (!callSessionId) return;

    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session) return;
    if (session.callerId !== userId && session.receiverId !== userId) return;

    const startTime = session.callStatus === CallSessionStatus.CONNECTED ? session.createdAt : null;
    const endTime = new Date();
    const durationSeconds = startTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : 0;

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.ENDED);
    await this.callLogService.updateEnd(
      callSessionId,
      endTime,
      CallStatus.ENDED,
      durationSeconds,
    );
    await this.callSessionService.deleteBySessionId(callSessionId);

    const otherId = session.callerId === userId ? session.receiverId : session.callerId;
    this.server.to(this.getSocketIdsForUser(session.callerId)).emit('call:end', { callSessionId });
    this.server.to(this.getSocketIdsForUser(session.receiverId)).emit('call:end', { callSessionId });
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
