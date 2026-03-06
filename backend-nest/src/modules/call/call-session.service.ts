import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  CallSession,
  CallSessionDocument,
  CallSessionStatus,
} from './schemas/call-session.schema';

export interface CreateSessionDto {
  callerId: number;
  receiverId: number;
}

@Injectable()
export class CallSessionService {
  private readonly logger = new Logger(CallSessionService.name);

  constructor(
    @InjectModel(CallSession.name)
    private readonly model: Model<CallSessionDocument>,
  ) { }

  /**
   * Create a new call session with a fresh UUID.
   * The document persists in MongoDB until a scheduled cleanup removes ended sessions
   * older than a configured TTL. We never hard-delete on end/reject/timeout to prevent
   * "Session not found" races between socket and REST end calls.
   */
  async create(dto: CreateSessionDto): Promise<CallSessionDocument> {
    const session = new this.model({
      callSessionId: uuidv4(),
      callerId: dto.callerId,
      receiverId: dto.receiverId,
      callStatus: CallSessionStatus.INITIATED,
      ringingUsers: [dto.receiverId],
      connectedUsers: [],
      iceCandidates: [],
    });
    const doc = await session.save();
    this.logger.log(`[call_session_created] callSessionId=${doc.callSessionId} caller=${dto.callerId} receiver=${dto.receiverId}`);
    return doc;
  }

  /** Find by UUID string — the primary lookup used by all service methods. */
  async findBySessionId(callSessionId: string): Promise<CallSessionDocument | null> {
    return this.model.findOne({ callSessionId }).exec();
  }

  async setRinging(callSessionId: string): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        { $set: { callStatus: CallSessionStatus.RINGING } },
        { new: true },
      )
      .exec();
  }

  async setConnected(
    callSessionId: string,
    userIds: number[],
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        {
          $set: {
            callStatus: CallSessionStatus.CONNECTED,
            connectedUsers: userIds,
          },
        },
        { new: true },
      )
      .exec();
  }

  async setOffer(
    callSessionId: string,
    offer: Record<string, unknown>,
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        { $set: { offer } },
        { new: true },
      )
      .exec();
  }

  async setAnswer(
    callSessionId: string,
    answer: Record<string, unknown>,
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        { $set: { answer } },
        { new: true },
      )
      .exec();
  }

  async addIceCandidate(
    callSessionId: string,
    fromUserId: number,
    candidate: Record<string, unknown>,
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        { $push: { iceCandidates: { from: fromUserId, candidate } } },
        { new: true },
      )
      .exec();
  }

  /**
   * Soft-end a session: update its status and set endedAt timestamp.
   * We intentionally do NOT hard-delete here — keeping the document prevents
   * the "Session not found" error when the socket event and REST call race.
   * Background cleanup removes ended documents after a safe TTL.
   */
  async setEnded(
    callSessionId: string,
    status: string = CallSessionStatus.ENDED,
  ): Promise<CallSessionDocument | null> {
    const doc = await this.model
      .findOneAndUpdate(
        { callSessionId },
        { $set: { callStatus: status, endedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (doc) {
      this.logger.log(`[call_session_ended] callSessionId=${callSessionId} status=${status}`);
    }
    return doc;
  }

  /**
   * Hard-delete a session by ID. Only called from cleanup jobs, not from
   * call flow methods (end/reject/timeout) to avoid race conditions.
   */
  async deleteBySessionId(callSessionId: string): Promise<void> {
    await this.model.deleteOne({ callSessionId }).exec();
    this.logger.log(`[call_session_deleted] callSessionId=${callSessionId}`);
  }

  /** Find active (non-terminal) session where user is caller or receiver */
  async findActiveSessionByUser(userId: number): Promise<CallSessionDocument | null> {
    return this.model
      .findOne({
        callStatus: {
          $in: [
            CallSessionStatus.INITIATED,
            CallSessionStatus.RINGING,
            CallSessionStatus.CONNECTED,
          ],
        },
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /** Count active (non-terminal) sessions for user — used by PresenceService */
  async countActiveSessionsForUser(userId: number): Promise<number> {
    return this.model
      .countDocuments({
        callStatus: {
          $in: [
            CallSessionStatus.INITIATED,
            CallSessionStatus.RINGING,
            CallSessionStatus.CONNECTED,
          ],
        },
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /** Count only CONNECTED sessions (user is actually mid-call) */
  async countConnectedSessionsForUser(userId: number): Promise<number> {
    return this.model
      .countDocuments({
        callStatus: CallSessionStatus.CONNECTED,
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /**
   * Marks stale RINGING sessions (>35s) as TIMEOUT/MISSED instead of deleting them.
   * This runs at the start of each initiate() to clean up orphaned sessions from
   * server restarts without causing "Session not found" on any concurrent end() call.
   * Returns number of sessions updated.
   */
  async markStaleRingingsAsMissed(): Promise<number> {
    const cutoff = new Date(Date.now() - 35_000);
    const result = await this.model.updateMany(
      {
        callStatus: CallSessionStatus.RINGING,
        createdAt: { $lt: cutoff },
      },
      {
        $set: { callStatus: CallSessionStatus.TIMEOUT, endedAt: new Date() },
      },
    ).exec();
    const count = result.modifiedCount ?? 0;
    if (count > 0) {
      this.logger.warn(`[stale_sessions_marked] ${count} stale RINGING session(s) marked TIMEOUT`);
    }
    return count;
  }

  /**
   * Cleanup job: hard-delete ended/terminal sessions older than the given TTL.
   * Safe to run on a schedule (e.g. every 5 minutes) without affecting active calls.
   */
  async deleteTerminatedOlderThan(ageMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - ageMs);
    const result = await this.model.deleteMany({
      callStatus: {
        $in: [
          CallSessionStatus.ENDED,
          CallSessionStatus.REJECTED,
          CallSessionStatus.TIMEOUT,
        ],
      },
      endedAt: { $lt: cutoff },
    }).exec();
    const count = result.deletedCount ?? 0;
    if (count > 0) {
      this.logger.log(`[call_session_cleanup] deleted ${count} terminated session(s) older than ${ageMs}ms`);
    }
    return count;
  }
}
