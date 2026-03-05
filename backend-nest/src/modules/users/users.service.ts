import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, ExpertStatus } from './entities/user.entity';
import { EncryptionService } from '../../core/encryption/encryption.service';

/** Same shape as GET /users/me for consistent app session updates. */
export interface UserMeDto {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  expertStatus: string | null;
  profileCompleted: boolean;
}

/** Used to gate app: force Complete Profile screen when not complete. */
export interface ProfileStatusDto {
  profileComplete: boolean;
  missingFields: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private encryption: EncryptionService,
  ) { }

  async findById(id: number | string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: Number(id) } });
  }

  /** Build response shape for GET /users/me and POST /users/profile/complete. */
  toMeDto(user: User): UserMeDto {
    const phone = this.getPhoneDecrypted(user);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone,
      role: user.role,
      expertStatus: user.expertStatus,
      profileCompleted: user.profileCompleted,
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
}
