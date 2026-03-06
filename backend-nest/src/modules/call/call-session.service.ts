import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectModel(CallSession.name)
    private readonly model: Model<CallSessionDocument>,
  ) {}

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
    return session.save();
  }

  async findBySessionId(
    callSessionId: string,
  ): Promise<CallSessionDocument | null> {
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

  async setEnded(
    callSessionId: string,
    status: string = CallSessionStatus.ENDED,
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOneAndUpdate(
        { callSessionId },
        { $set: { callStatus: status, endedAt: new Date() } },
        { new: true },
      )
      .exec();
  }

  async deleteBySessionId(callSessionId: string): Promise<void> {
    await this.model.deleteOne({ callSessionId }).exec();
  }

  /** Find active (non-ended) session where user is caller or receiver */
  async findActiveSessionByUser(
    userId: number,
  ): Promise<CallSessionDocument | null> {
    return this.model
      .findOne({
        callStatus: { $in: [CallSessionStatus.INITIATED, CallSessionStatus.RINGING, CallSessionStatus.CONNECTED] },
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /** All active sessions (for presence) */
  async countActiveSessionsForUser(userId: number): Promise<number> {
    return this.model
      .countDocuments({
        callStatus: { $in: [CallSessionStatus.INITIATED, CallSessionStatus.RINGING, CallSessionStatus.CONNECTED] },
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /** Only CONNECTED sessions (user is actually in a call). */
  async countConnectedSessionsForUser(userId: number): Promise<number> {
    return this.model
      .countDocuments({
        callStatus: CallSessionStatus.CONNECTED,
        $or: [{ callerId: userId }, { receiverId: userId }],
      })
      .exec();
  }

  /** Remove stale RINGING sessions (e.g. server restarted and timeout never ran). Older than 35s. */
  async deleteStaleRingingSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - 35_000);
    const result = await this.model.deleteMany({
      callStatus: CallSessionStatus.RINGING,
      createdAt: { $lt: cutoff },
    }).exec();
    return result.deletedCount ?? 0;
  }
}
