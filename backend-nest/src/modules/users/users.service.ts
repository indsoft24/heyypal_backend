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

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async completeProfile(
    userId: string,
    data: { name: string; phone: string; role: UserRole },
  ): Promise<User> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    user.name = data.name;
    user.phoneEnc = this.encryption.encrypt(data.phone);
    user.role = data.role;
    user.expertStatus = data.role === UserRole.EXPERT ? ExpertStatus.PENDING : null;
    user.profileCompleted = true;
    return this.userRepo.save(user);
  }

  getPhoneDecrypted(user: User): string | null {
    return user.phoneEnc ? this.encryption.decrypt(user.phoneEnc) : null;
  }
}
