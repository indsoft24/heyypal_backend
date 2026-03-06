import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { CallSessionService } from './call-session.service';
import { CallLogService } from './call-log.service';
import { CallGateway } from './call.gateway';
import { AgoraService } from '../agora/agora.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { PresenceService } from './presence.service';
import { CallLog, CallStatus } from './entities/call-log.entity';
import { CallSessionStatus } from './schemas/call-session.schema';

const CALL_RING_TIMEOUT_MS = 30_000;

export interface InitiateResult {
  callSessionId: string;
  channelName: string;
  token: string;
  appId: string;
  uid: number;
}

export interface AcceptResult {
  token: string;
  appId: string;
  channelName: string;
  uid: number;
}

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);
  private readonly ringTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly callSessionService: CallSessionService,
    private readonly callLogService: CallLogService,
    @Inject(forwardRef(() => CallGateway))
    private readonly callGateway: CallGateway,
    private readonly agoraService: AgoraService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
  ) {}

  private clearRingTimeout(callSessionId: string): void {
    const t = this.ringTimeouts.get(callSessionId);
    if (t) {
      clearTimeout(t);
      this.ringTimeouts.delete(callSessionId);
    }
  }

  /** Initiate call: create session, log, Agora token for caller, FCM + optional socket to receiver. */
  async initiate(callerId: number, receiverId: number): Promise<{ busy?: boolean; result?: InitiateResult }> {
    const inCall = await this.presenceService.isUserInCall(receiverId);
    if (inCall) {
      return { busy: true };
    }

    const session = await this.callSessionService.create({ callerId, receiverId });
    const callSessionId = session.callSessionId;
    await this.callSessionService.setRinging(callSessionId);

    const channelName = `call_${callSessionId}`;

    await this.callLogService.create({
      callSessionId,
      callerId,
      receiverId,
      callStatus: CallStatus.RINGING,
      callType: 'audio',
      missedFlag: false,
    });

    const tokenResult = this.agoraService.generateRtcToken({
      channelName,
      userId: callerId,
      role: 'publisher',
      expireSeconds: 3600,
    });

    const receiver = await this.usersService.findById(receiverId);
    if (receiver?.fcmToken) {
      await this.notificationsService.sendIncomingCallPush(receiver.fcmToken, {
        callSessionId,
        callerId: String(callerId),
        channelName,
        callerName: receiver.name ?? undefined,
      });
    }

    this.callGateway.emitToUser(receiverId, 'call:ringing', {
      callSessionId,
      callerId,
      channelName,
    });

    this.ringTimeouts.set(
      callSessionId,
      setTimeout(() => this.handleRingTimeout(callSessionId), CALL_RING_TIMEOUT_MS),
    );

    return {
      result: {
        callSessionId,
        channelName,
        token: tokenResult.token,
        appId: tokenResult.appId,
        uid: callerId,
      },
    };
  }

  private async handleRingTimeout(callSessionId: string): Promise<void> {
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

    this.callGateway.emitToUser(session.callerId, 'call:timeout', { callSessionId });
  }

  /** Accept call: clear timeout, set connected, update log, return Agora token for callee. */
  async accept(receiverId: number, callSessionId: string): Promise<{ ok: boolean; result?: AcceptResult; message?: string }> {
    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.receiverId !== receiverId) {
      return { ok: false, message: 'Session not found or not receiver' };
    }
    if (session.callStatus !== CallSessionStatus.RINGING) {
      return { ok: false, message: 'Call not ringing' };
    }

    await this.callSessionService.setConnected(callSessionId, [session.callerId, session.receiverId]);
    const startTime = new Date();
    await this.callLogService.updateToConnected(callSessionId, startTime);

    const channelName = `call_${callSessionId}`;
    const tokenResult = this.agoraService.generateRtcToken({
      channelName,
      userId: receiverId,
      role: 'publisher',
      expireSeconds: 3600,
    });

    this.callGateway.emitToUser(session.callerId, 'call:accept', {
      callSessionId,
      acceptedBy: receiverId,
    });

    return {
      ok: true,
      result: {
        token: tokenResult.token,
        appId: tokenResult.appId,
        channelName,
        uid: receiverId,
      },
    };
  }

  /** Reject call. */
  async reject(receiverId: number, callSessionId: string): Promise<{ ok: boolean; message?: string }> {
    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.receiverId !== receiverId) {
      return { ok: false, message: 'Session not found or not receiver' };
    }

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.REJECTED);
    await this.callLogService.updateEnd(callSessionId, new Date(), CallStatus.REJECTED, 0);
    await this.callSessionService.deleteBySessionId(callSessionId);

    this.callGateway.emitToUser(session.callerId, 'call:reject', { callSessionId, rejectedBy: receiverId });
    return { ok: true };
  }

  /** End call (caller or callee). */
  async end(userId: number, callSessionId: string): Promise<{ ok: boolean; message?: string }> {
    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session) return { ok: false, message: 'Session not found' };
    if (session.callerId !== userId && session.receiverId !== userId) {
      return { ok: false, message: 'Not a participant' };
    }

    const endTime = new Date();
    let durationSeconds = 0;
    const log = await this.callLogService.findBySessionId(callSessionId);
    if (log?.startTime) {
      durationSeconds = Math.floor((endTime.getTime() - new Date(log.startTime!).getTime()) / 1000);
    }

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.ENDED);
    await this.callLogService.updateEnd(callSessionId, endTime, CallStatus.ENDED, durationSeconds);
    await this.callSessionService.deleteBySessionId(callSessionId);

    this.callGateway.emitToUser(session.callerId, 'call:end', { callSessionId });
    this.callGateway.emitToUser(session.receiverId, 'call:end', { callSessionId });
    return { ok: true };
  }
}
