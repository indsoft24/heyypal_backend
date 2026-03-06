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

// Terminal statuses — session cannot transition further from these.
const TERMINAL_STATUSES = new Set([
  CallSessionStatus.ENDED,
  CallSessionStatus.REJECTED,
  CallSessionStatus.TIMEOUT,
]);

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
  ) { }

  private clearRingTimeout(callSessionId: string): void {
    const t = this.ringTimeouts.get(callSessionId);
    if (t) {
      clearTimeout(t);
      this.ringTimeouts.delete(callSessionId);
    }
  }

  /** Initiate call: create session, log, Agora token for caller, FCM + socket to receiver. */
  async initiate(callerId: number, receiverId: number): Promise<{ busy?: boolean; result?: InitiateResult }> {
    // Clean up truly stale sessions (>35s old still in RINGING) from crashed server instances.
    await this.callSessionService.markStaleRingingsAsMissed();

    const inConnectedCall = await this.presenceService.isUserInConnectedCall(receiverId);
    if (inConnectedCall) {
      this.logger.log(`[call_initiate_blocked] receiver=${receiverId} is in an active call`);
      return { busy: true };
    }

    const session = await this.callSessionService.create({ callerId, receiverId });
    const callSessionId = session.callSessionId;
    await this.callSessionService.setRinging(callSessionId);

    const channelName = `call_${callSessionId}`;

    // Create postgres log row immediately so it always exists for updates.
    await this.callLogService.upsertInitiated({
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

    // Send FCM push to receiver.
    // Load both caller and receiver entities.
    // receiver → provides the FCM token to push to.
    // caller → provides the name shown on the receiver's incoming call screen.
    const [caller, receiver] = await Promise.all([
      this.usersService.findById(callerId),
      this.usersService.findById(receiverId),
    ]);

    if (receiver?.fcmToken) {
      this.logger.log(`[call_initiated] callSessionId=${callSessionId} caller=${callerId} → pushing FCM to receiver=${receiverId}`);
      await this.notificationsService.sendIncomingCallPush(receiver.fcmToken, {
        callSessionId,
        callerId: String(callerId),
        channelName,
        callerName: caller?.name ?? undefined,   // ← caller's name, not receiver's
      });
    } else {
      this.logger.warn(`[call_initiated] callSessionId=${callSessionId} receiver=${receiverId} has no FCM token; push skipped`);
    }

    // Emit socket event to receiver (if online via Socket.io).
    // Include channelName and callerName so the receiver can launch IncomingCallActivity
    // directly from the socket event without an extra API call.
    this.callGateway.emitToUser(receiverId, 'call:ringing', {
      callSessionId,
      callerId,
      channelName,
      callerName: caller?.name ?? '',
    });

    // Set ring timeout — marks MISSED in MongoDB + Postgres but does NOT delete document.
    this.ringTimeouts.set(
      callSessionId,
      setTimeout(() => this.handleRingTimeout(callSessionId), CALL_RING_TIMEOUT_MS),
    );

    this.logger.log(`[call_initiated] callSessionId=${callSessionId} caller=${callerId} receiver=${receiverId}`);

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

  /**
   * Ring timeout: receiver didn't answer in 30s.
   * Updates status to MISSED in MongoDB + Postgres. Does NOT delete the document —
   * the caller's /api/call/end will find it and gracefully handle a terminal status.
   */
  private async handleRingTimeout(callSessionId: string): Promise<void> {
    this.ringTimeouts.delete(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);
    if (!session || session.callStatus !== CallSessionStatus.RINGING) return;

    this.logger.log(`[call_timeout] callSessionId=${callSessionId} — marking MISSED`);

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.TIMEOUT);
    await this.callLogService.updateEnd(callSessionId, new Date(), CallStatus.MISSED, 0, true);

    this.callGateway.emitToUser(session.callerId, 'call:timeout', { callSessionId });
    this.callGateway.emitToUser(session.receiverId, 'call:timeout', { callSessionId });
  }

  /** Accept call: clear timeout, set connected, update log, return Agora token for callee. */
  async accept(receiverId: number, callSessionId: string): Promise<{ ok: boolean; result?: AcceptResult; message?: string }> {
    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);

    if (!session) {
      this.logger.warn(`[session_not_found] accept callSessionId=${callSessionId} receiverId=${receiverId}`);
      return { ok: false, message: 'Session not found' };
    }
    if (session.receiverId !== receiverId) {
      return { ok: false, message: 'Not the receiver of this call' };
    }
    if (TERMINAL_STATUSES.has(session.callStatus as any)) {
      return { ok: false, message: `Call already ${session.callStatus}` };
    }
    if (session.callStatus === CallSessionStatus.CONNECTED) {
      // Idempotent: already accepted — still give caller token.
      this.logger.log(`[call_accepted] idempotent re-accept callSessionId=${callSessionId}`);
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

    this.logger.log(`[call_accepted] callSessionId=${callSessionId} receiver=${receiverId}`);

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

    if (!session) {
      this.logger.warn(`[session_not_found] reject callSessionId=${callSessionId} receiverId=${receiverId}`);
      return { ok: false, message: 'Session not found' };
    }
    if (session.receiverId !== receiverId) {
      return { ok: false, message: 'Not the receiver of this call' };
    }
    if (TERMINAL_STATUSES.has(session.callStatus as any)) {
      // Already terminated — idempotent success.
      return { ok: true };
    }

    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.REJECTED);
    await this.callLogService.updateEnd(callSessionId, new Date(), CallStatus.REJECTED, 0);

    this.callGateway.emitToUser(session.callerId, 'call:reject', { callSessionId, rejectedBy: receiverId });
    this.logger.log(`[call_rejected] callSessionId=${callSessionId} receiver=${receiverId}`);
    return { ok: true };
  }

  /**
   * End call (caller or callee) via REST or socket.
   *
   * Idempotent:
   *  - If already ENDED → return ok:true (no double-logging).
   *  - If TIMEOUT/REJECTED/MISSED → return ok:true (session exists, already finalized).
   *  - If session not found at all → return ok:true with a warning (may have been cleaned).
   *
   * Does NOT delete the MongoDB document — documents are cleaned by a scheduled job
   * or the next initiate() stale cleanup. This prevents "Session not found" when
   * the socket event and REST call race each other.
   */
  async end(userId: number, callSessionId: string): Promise<{ ok: boolean; message?: string }> {
    this.clearRingTimeout(callSessionId);
    const session = await this.callSessionService.findBySessionId(callSessionId);

    if (!session) {
      // Session missing: likely already cleaned up. Log a warning but return ok
      // so the Android client doesn't stay stuck on the call screen.
      this.logger.warn(`[session_not_found] end callSessionId=${callSessionId} userId=${userId} — treating as success`);
      return { ok: true, message: 'Session already finalized' };
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      this.logger.warn(`[call_end_forbidden] userId=${userId} is not a participant of callSessionId=${callSessionId}`);
      return { ok: false, message: 'Not a participant' };
    }

    // Idempotent: already in a terminal state — acknowledge without re-logging.
    if (TERMINAL_STATUSES.has(session.callStatus as any) || session.callStatus === CallSessionStatus.CONNECTED) {
      if (session.callStatus !== CallSessionStatus.CONNECTED) {
        this.logger.log(`[call_end] idempotent — callSessionId=${callSessionId} already ${session.callStatus}`);
        // Still emit end event to guarantee both sides get it.
        this.callGateway.emitToUser(session.callerId, 'call:end', { callSessionId });
        this.callGateway.emitToUser(session.receiverId, 'call:end', { callSessionId });
        return { ok: true };
      }
    }

    const endTime = new Date();
    let durationSeconds = 0;
    const log = await this.callLogService.findBySessionId(callSessionId);
    if (log?.startTime) {
      durationSeconds = Math.max(0, Math.floor((endTime.getTime() - new Date(log.startTime).getTime()) / 1000));
    }

    // Update MongoDB status (soft-end, keep document).
    await this.callSessionService.setEnded(callSessionId, CallSessionStatus.ENDED);
    // Update postgres log.
    await this.callLogService.updateEnd(callSessionId, endTime, CallStatus.ENDED, durationSeconds);

    // If call was still ringing (not connected), the receiver might be in a killed app state
    // where the socket isn't connected yet. Send an FCM push to cancel the OS-level ring.
    if (session.callStatus === CallSessionStatus.RINGING) {
      const receiver = await this.usersService.findById(session.receiverId);
      if (receiver?.fcmToken) {
        await this.notificationsService.sendCallEndedPush(receiver.fcmToken, callSessionId);
      }
    }

    // Notify both sides via socket (for foreground users).
    this.callGateway.emitToUser(session.callerId, 'call:end', { callSessionId });
    this.callGateway.emitToUser(session.receiverId, 'call:end', { callSessionId });

    this.logger.log(`[call_ended] callSessionId=${callSessionId} userId=${userId} duration=${durationSeconds}s`);
    return { ok: true };
  }
}
