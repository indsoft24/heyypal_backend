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

@Schema({ timestamps: true, collection: 'call_sessions' })
export class CallSession {
  @Prop({ required: true, unique: true })
  callSessionId: string;

  @Prop({ required: true })
  callerId: number;

  @Prop({ required: true })
  receiverId: number;

  @Prop({ type: String, default: CallSessionStatus.INITIATED })
  callStatus: string;

  @Prop({ type: Object })
  offer: Record<string, unknown> | null;

  @Prop({ type: Object })
  answer: Record<string, unknown> | null;

  @Prop({ type: [Object], default: [] })
  iceCandidates: Array<{ from: number; candidate: Record<string, unknown> }>;

  @Prop({ type: [Number], default: [] })
  ringingUsers: number[];

  @Prop({ type: [Number], default: [] })
  connectedUsers: number[];

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);

CallSessionSchema.index({ callSessionId: 1 }, { unique: true });
CallSessionSchema.index({ callerId: 1, callStatus: 1 });
CallSessionSchema.index({ receiverId: 1, callStatus: 1 });
CallSessionSchema.index({ callStatus: 1 });
