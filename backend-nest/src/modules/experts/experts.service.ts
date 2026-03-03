import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpertProfile, ExpertCategory } from './entities/expert-profile.entity';
import { User, ExpertStatus, ExpertType } from '../users/entities/user.entity';

@Injectable()
export class ExpertsService {
  constructor(
    @InjectRepository(ExpertProfile) private expertRepo: Repository<ExpertProfile>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) { }

  async submitExpertProfile(userId: number, payload: {
    type: ExpertType;
    category: ExpertCategory;
    bio: string;
    languagesSpoken: string[];
    photos: string[];
    introVideoUrl: string;
    introVideoCompressedUrl?: string;
    degreeCertificateUrl?: string;
    aadharUrl?: string;
  }): Promise<ExpertProfile> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'expert') {
      throw new ForbiddenException('Only expert users can submit expert profile');
    }

    user.expertStatus = ExpertStatus.PENDING;
    user.expertType = payload.type;
    await this.userRepo.save(user);

    const profile = this.expertRepo.create({
      user,
      ...payload,
      introVideoCompressedUrl:
        payload.introVideoCompressedUrl ?? payload.introVideoUrl,
    });

    return this.expertRepo.save(profile);
  }

  async listExpertRequests(): Promise<ExpertProfile[]> {
    return this.expertRepo.find({ relations: ['user'] });
  }

  async findByUserId(userId: number): Promise<ExpertProfile | null> {
    return this.expertRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
  }
}

