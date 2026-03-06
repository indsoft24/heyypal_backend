import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  CONNECTED = 'connected',
  ENDED = 'ended',
  REJECTED = 'rejected',
  BUSY = 'busy',
  MISSED = 'missed',
  TIMEOUT = 'timeout',
}

@Entity('call_logs')
@Index(['callerId', 'createdAt'])
@Index(['receiverId', 'createdAt'])
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'call_session_id', type: 'varchar', length: 64 })
  callSessionId: string;

  @Column({ name: 'caller_id', type: 'int' })
  callerId: number;

  @Column({ name: 'receiver_id', type: 'int' })
  receiverId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'caller_id' })
  caller: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({
    name: 'call_status',
    type: 'varchar',
    length: 24,
    default: CallStatus.ENDED,
  })
  callStatus: CallStatus;

  @Column({ name: 'start_time', type: 'timestamptz', nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'call_type', type: 'varchar', length: 16, default: 'audio' })
  callType: string;

  @Column({
    name: 'missed_flag',
    type: 'boolean',
    default: false,
  })
  missedFlag: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
