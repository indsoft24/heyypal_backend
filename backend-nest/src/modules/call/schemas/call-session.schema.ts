import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CallSessionDocument = CallSession & Document;

export const CallSessionStatus = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  ENDED: 'ended',
  REJECTED: 'rejected',
  BUSY: 'busy',
  TIMEOUT: 'timeout',
} as const;

export type CallSessionStatusValue = typeof CallSessionStatus[keyof typeof CallSessionStatus];

@Schema({ timestamps: true, collection: 'call_sessions' })
export class CallSession {
  /** UUID string — primary lookup key for all call service methods. */
  @Prop({ required: true, unique: true, type: String })
  callSessionId: string;

  @Prop({ required: true, type: Number })
  callerId: number;

  @Prop({ required: true, type: Number })
  receiverId: number;

  @Prop({ type: String, enum: Object.values(CallSessionStatus), default: CallSessionStatus.INITIATED })
  callStatus: string;

  @Prop({ type: Object, default: null })
  offer: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  answer: Record<string, unknown> | null;

  @Prop({ type: [Object], default: [] })
  iceCandidates: Array<{ from: number; candidate: Record<string, unknown> }>;

  @Prop({ type: [Number], default: [] })
  ringingUsers: number[];

  @Prop({ type: [Number], default: [] })
  connectedUsers: number[];

  /**
   * createdAt is set automatically by the { timestamps: true } schema option.
   * Declared here so TypeScript knows the field exists on CallSessionDocument.
   */
  @Prop({ type: Date })
  createdAt: Date;

  /**
   * endedAt is set by setEnded(). Used by the TTL index to auto-purge
   * terminal sessions from MongoDB 10 minutes after they end.
   * null while session is active.
   */
  @Prop({ type: Date, default: null })
  endedAt: Date | null;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);

// ── Lookup indexes ──────────────────────────────────────────────────────────
// Primary lookup: callSessionId string (UUID).
CallSessionSchema.index({ callSessionId: 1 }, { unique: true });
// Presence/busy checks.
CallSessionSchema.index({ callerId: 1, callStatus: 1 });
CallSessionSchema.index({ receiverId: 1, callStatus: 1 });
// Stale-ringing cleanup scan.
CallSessionSchema.index({ callStatus: 1, createdAt: 1 });

// ── TTL auto-purge ───────────────────────────────────────────────────────────
// MongoDB will automatically delete documents 600 seconds (10 min) after endedAt.
// This replaces manual deleteBySessionId calls in the call flow and prevents
// "Session not found" races. Active sessions have endedAt=null and are never purged.
CallSessionSchema.index({ endedAt: 1 }, { expireAfterSeconds: 600, sparse: true });
