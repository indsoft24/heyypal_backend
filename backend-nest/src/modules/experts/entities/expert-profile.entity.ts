import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExpertType } from '../../users/entities/user.entity';

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
  user: User;

  @Column({ type: 'enum', enum: ExpertType })
  type: ExpertType;

  @Column({ type: 'enum', enum: ExpertCategory })
  category: ExpertCategory;

  @Column({ type: 'varchar', length: 300 })
  bio: string;

  @Column({ type: 'simple-array', name: 'languages_spoken' })
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

