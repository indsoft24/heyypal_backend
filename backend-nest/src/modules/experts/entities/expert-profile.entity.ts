import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExpertType } from '../../users/entities/user.entity';

/** @deprecated Use Category entity and categoryId/name. Kept for backward compatibility in DTOs. */
export enum ExpertCategory {
  FITNESS = 'Fitness',
  EMOTIONAL_HELP = 'Emotional help',
  RELATIONSHIPS = 'Relationships',
  SKINCARE = 'Skincare',
  COMFORT_ZONE = 'Comfort Zone',
  FASHION = 'Fashion',
  COMEDIAN = 'Comedian',
  STORY_TELLING = 'Story Telling',
}

@Entity('expert_profiles')
export class ExpertProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ExpertType, nullable: true })
  type: ExpertType;

  /** Category name (matches Category.name). Stored for filtering; source of truth is categories table. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  bio: string;

  @Column({ type: 'simple-array', name: 'languages_spoken', nullable: true })
  languagesSpoken: string[];

  @Column({ type: 'simple-array', name: 'photos', nullable: true })
  photos: string[] | null;

  @Column({ type: 'varchar', name: 'intro_video', nullable: true })
  introVideoUrl: string | null;

  @Column({ type: 'varchar', name: 'intro_video_compressed', nullable: true })
  introVideoCompressedUrl: string | null;

  @Column({ type: 'varchar', name: 'degree_certificate', nullable: true })
  degreeCertificateUrl: string | null;

  @Column({ type: 'varchar', name: 'aadhar', nullable: true })
  aadharUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

