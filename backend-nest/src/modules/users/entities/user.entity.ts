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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  googleId: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  /** Encrypted at rest (PII) */
  @Column({ nullable: true })
  phoneEnc: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: ExpertStatus, nullable: true })
  expertStatus: ExpertStatus | null;

  @Column({ default: false })
  profileCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (rt) => rt.user)
  refreshTokens: RefreshToken[];
}
