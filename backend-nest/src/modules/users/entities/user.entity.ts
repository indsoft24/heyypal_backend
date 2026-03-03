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

export enum ExpertType {
  SUPPORTIVE = 'supportive',
  PROFESSIONAL = 'professional',
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

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'expert_type' })
  expertType: ExpertType | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'gender' })
  gender: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'date_of_birth' })
  dateOfBirth: string | null;

  @Column({
    name: 'profile_completed',
    type: 'smallint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => v === 1 },
  })
  profileCompleted: boolean;

  /** File key only (e.g. profile/user/123/photo1.jpg). No full URL. */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'profile_photo_1_key' })
  profilePhoto1Key: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'profile_photo_2_key' })
  profilePhoto2Key: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RefreshToken, (rt) => rt.user)
  refreshTokens: RefreshToken[];
}
