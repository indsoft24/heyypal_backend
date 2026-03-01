import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

export enum UserRole {
  USER = 'user',
  EXPERT = 'expert',
  ADMIN = 'admin',
}

export enum ExpertStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, name: 'google_id' })
  googleId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  /** Encrypted at rest (PII); DB column: phone */
  @Column({ nullable: true, name: 'phone' })
  phoneEnc: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: ExpertStatus, nullable: true, name: 'expert_status' })
  expertStatus: ExpertStatus | null;

  @Column({
    name: 'profile_completed',
    type: 'smallint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 },
  })
  profileCompleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (rt) => rt.user)
  refreshTokens: RefreshToken[];
}
