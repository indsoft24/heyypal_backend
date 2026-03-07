import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User, UserRole, ExpertStatus } from './entities/user.entity';
import { UserPreference } from './entities/user-preference.entity';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { CallLog, CallStatus } from '../call/entities/call-log.entity';
import { Message } from '../chat/entities/message.entity';
import { UploadService } from '../upload/upload.service';

/** Stats returned in GET /users/me and profile-stats. */
export interface UserStatsDto {
  sessionsCount: number;
  rating: number | null;
  spentAmount: number;
}

/** Same shape as GET /users/me for consistent app session updates. */
export interface UserMeDto {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  expertStatus: string | null;
  profileCompleted: boolean;
  profilePicUrl: string | null;
  stats: UserStatsDto;
}

/** Used to gate app: force Complete Profile screen when not complete. */
export interface ProfileStatusDto {
  profileComplete: boolean;
  missingFields: string[];
}

/** One session in GET /users/sessions (call or chat). */
export interface SessionHistoryItemDto {
  type: 'call' | 'chat';
  timestamp: string;
  durationSeconds?: number;
  amount?: number;
  expert: { id: number; name: string; profilePicUrl: string | null };
}

@Injectable()
export class UsersService {
  private readonly publicBaseUrl: string;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserPreference) private prefRepo: Repository<UserPreference>,
    @InjectRepository(CallLog) private callLogRepo: Repository<CallLog>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private encryption: EncryptionService,
    private config: ConfigService,
    private uploadService: UploadService,
  ) {
    const base = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:5001';
    this.publicBaseUrl = base.replace(/\/$/, '');
  }

  async findById(id: number | string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: Number(id) } });
  }

  /** Build public URL for a stored profile photo key. */
  getProfilePicUrl(key: string | null): string | null {
    if (!key?.trim()) return null;
    return `${this.publicBaseUrl}/uploads/${key.replace(/^\/+/, '')}`;
  }

  /** Build response shape for GET /users/me and POST /users/profile/complete. */
  toMeDto(user: User, stats?: UserStatsDto): UserMeDto {
    const phone = this.getPhoneDecrypted(user);
    const profilePicUrl = this.getProfilePicUrl(user.profilePhoto1Key);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone,
      role: user.role,
      expertStatus: user.expertStatus,
      profileCompleted: user.profileCompleted,
      profilePicUrl,
      stats: stats ?? { sessionsCount: 0, rating: null, spentAmount: 0 },
    };
  }

  /** Aggregate stats for profile: sessions count (ended calls + distinct chat peers), rating (null for now), spentAmount (0 until billing). */
  async getProfileStats(userId: number): Promise<UserStatsDto> {
    const uid = Number(userId);
    const callCount = await this.callLogRepo.count({
      where: [
        { callerId: uid, callStatus: CallStatus.ENDED },
        { receiverId: uid, callStatus: CallStatus.ENDED },
      ],
    });
    const chatPeers = await this.messageRepo
      .createQueryBuilder('m')
      .select('DISTINCT CASE WHEN m.sender_id = :uid THEN m.receiver_id ELSE m.sender_id END', 'peer')
      .where('m.sender_id = :uid OR m.receiver_id = :uid')
      .setParameter('uid', uid)
      .getRawMany<{ peer: number }>();
    const sessionsCount = callCount + (chatPeers?.length ?? 0);
    return {
      sessionsCount,
      rating: null,
      spentAmount: 0,
    };
  }

  /**
   * Profile completion status by role. Used after login/register to force
   * Complete Profile screen when required fields are missing.
   */
  async getProfileStatus(userId: number | string): Promise<ProfileStatusDto> {
    const user = await this.findById(userId);
    if (!user) {
      return { profileComplete: false, missingFields: ['account'] };
    }
    if (user.profileCompleted) {
      return { profileComplete: true, missingFields: [] };
    }
    const missing: string[] = [];
    if (!user.name?.trim()) missing.push('name');
    const phone = this.getPhoneDecrypted(user);
    if (!phone?.trim()) missing.push('phone');
    if (!user.role) missing.push('role');
    return { profileComplete: false, missingFields: missing };
  }

  async completeProfile(
    userId: number | string,
    data: {
      name: string;
      phone: string;
      role: UserRole;
      gender?: string;
      dateOfBirth?: string;
      date_of_birth?: string;
    },
  ): Promise<User> {
    const user = await this.userRepo.findOneOrFail({ where: { id: Number(userId) } });
    user.name = data.name;
    user.phoneEnc = this.encryption.encrypt(data.phone);
    user.role = data.role;
    user.expertStatus = data.role === UserRole.EXPERT ? ExpertStatus.PENDING : null;
    if (data.gender !== undefined) user.gender = data.gender || null;
    const dob = data.dateOfBirth ?? data.date_of_birth;
    if (dob !== undefined) user.dateOfBirth = dob || null;
    user.profileCompleted = true;
    return this.userRepo.save(user);
  }

  getPhoneDecrypted(user: User): string | null {
    return user.phoneEnc ? this.encryption.decrypt(user.phoneEnc) : null;
  }

  async updateFcmToken(userId: number, token: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken: token });
  }

  async getNotificationPreferences(userId: number): Promise<{ emailAlerts: boolean; pushPromo: boolean }> {
    let pref = await this.prefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.prefRepo.create({ userId, emailAlerts: true, pushPromo: false });
      await this.prefRepo.save(pref);
    }
    return { emailAlerts: pref.emailAlerts, pushPromo: pref.pushPromo };
  }

  async updateNotificationPreferences(
    userId: number,
    dto: { emailAlerts?: boolean; pushPromo?: boolean },
  ): Promise<{ emailAlerts: boolean; pushPromo: boolean }> {
    let pref = await this.prefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.prefRepo.create({ userId, emailAlerts: true, pushPromo: false });
      await this.prefRepo.save(pref);
    }
    if (dto.emailAlerts !== undefined) pref.emailAlerts = dto.emailAlerts;
    if (dto.pushPromo !== undefined) pref.pushPromo = dto.pushPromo;
    await this.prefRepo.save(pref);
    return { emailAlerts: pref.emailAlerts, pushPromo: pref.pushPromo };
  }

  async updateMe(
    userId: number | string,
    dto: { name?: string; gender?: string; dateOfBirth?: string },
    profilePhotoFile?: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<User> {
    const user = await this.userRepo.findOneOrFail({ where: { id: Number(userId) } });
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.gender !== undefined) user.gender = dto.gender || null;
    if (dto.dateOfBirth !== undefined) user.dateOfBirth = dto.dateOfBirth || null;
    if (profilePhotoFile) {
      const relPath = await this.uploadService.saveUserProfilePhoto(profilePhotoFile);
      user.profilePhoto1Key = relPath;
    }
    return this.userRepo.save(user);
  }

  async getSessions(
    userId: number,
    limit: number,
    offset: number,
  ): Promise<{ data: SessionHistoryItemDto[]; total: number }> {
    const uid = Number(userId);
    const [calls, chatPeers] = await Promise.all([
      this.callLogRepo.find({
        where: [
          { callerId: uid, callStatus: CallStatus.ENDED },
          { receiverId: uid, callStatus: CallStatus.ENDED },
        ],
        order: { startTime: 'DESC', createdAt: 'DESC' },
        relations: ['caller', 'receiver'],
      }),
      this.messageRepo
        .createQueryBuilder('m')
        .select('CASE WHEN m.sender_id = :uid THEN m.receiver_id ELSE m.sender_id END', 'peerId')
        .addSelect('MAX(m.created_at)', 'lastAt')
        .where('m.sender_id = :uid OR m.receiver_id = :uid')
        .setParameter('uid', uid)
        .groupBy('CASE WHEN m.sender_id = :uid THEN m.receiver_id ELSE m.sender_id END')
        .getRawMany<{ peerId: number; lastAt: Date }>(),
    ]);
    const callItems: SessionHistoryItemDto[] = calls.map((c) => {
      const expert = c.callerId === uid ? c.receiver : c.caller;
      return {
        type: 'call',
        timestamp: (c.startTime ?? c.createdAt).toISOString(),
        durationSeconds: c.durationSeconds,
        amount: 0,
        expert: {
          id: expert.id,
          name: expert.name ?? '',
          profilePicUrl: this.getProfilePicUrl(expert.profilePhoto1Key),
        },
      };
    });
    const peerIds = chatPeers.map((p) => p.peerId);
    const peerUsers =
      peerIds.length > 0
        ? await this.userRepo.find({ where: { id: In(peerIds) } }).catch(() => [])
        : [];
    const peerMap = new Map(peerUsers.map((u) => [u.id, u]));
    const chatItems: SessionHistoryItemDto[] = chatPeers.map((p) => {
      const expert = peerMap.get(p.peerId);
      return {
        type: 'chat',
        timestamp: new Date(p.lastAt).toISOString(),
        amount: 0,
        expert: {
          id: expert?.id ?? p.peerId,
          name: expert?.name ?? '',
          profilePicUrl: expert ? this.getProfilePicUrl(expert.profilePhoto1Key) : null,
        },
      };
    });
    const merged = [...callItems, ...chatItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const total = merged.length;
    const data = merged.slice(offset, offset + limit);
    return { data, total };
  }
}
