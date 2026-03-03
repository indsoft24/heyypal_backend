import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, ExpertStatus } from './entities/user.entity';
import { EncryptionService } from '../../core/encryption/encryption.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private encryption: EncryptionService,
  ) {}

  async findById(id: number | string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: Number(id) } });
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
}
