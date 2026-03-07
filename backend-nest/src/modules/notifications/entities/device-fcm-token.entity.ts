import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * FCM token per device. Schema: userId, deviceId, platform, fcmToken, lastActive.
 * Enables multi-device push and token refresh tracking.
 */
@Entity('device_fcm_tokens')
@Index(['userId', 'deviceId'], { unique: true })
export class DeviceFcmToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'device_id', length: 255 })
  deviceId: string;

  @Column({ length: 50, default: 'android' })
  platform: string;

  @Column({ name: 'fcm_token', type: 'varchar', length: 512 })
  fcmToken: string;

  @Column({ name: 'last_active', type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
  lastActive: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
