import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';

export enum ExpertVideoStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('expert_videos')
export class ExpertVideo {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** File key only (e.g. expert/456/intro.mp4). */
  @Column({ name: 'video_key' })
  videoKey: string;

  @Column({ name: 'thumbnail_key', nullable: true })
  thumbnailKey: string | null;

  /** Duration in seconds. */
  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({
    type: 'enum',
    enum: ExpertVideoStatus,
    default: ExpertVideoStatus.PENDING,
  })
  status: ExpertVideoStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}
