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
    introVideoUrl?: string;
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

    // Mirror profile photos into user table so the app can show avatars
    // even for experts (first two images are treated as profile photos).
    if (payload.photos?.length) {
      const [first, second] = payload.photos;
      user.profilePhoto1Key = first ?? user.profilePhoto1Key ?? null;
      if (second) {
        user.profilePhoto2Key = second;
      }
    }
    user.expertStatus = ExpertStatus.PENDING;
    user.expertType = payload.type;
    await this.userRepo.save(user);

    const introUrl = payload.introVideoUrl?.trim() || null;
    const introCompressed = payload.introVideoCompressedUrl?.trim() || introUrl;
    const profile = this.expertRepo.create({
      user,
      ...payload,
      introVideoUrl: introUrl,
      introVideoCompressedUrl: introCompressed,
    });

    return this.expertRepo.save(profile);
  }

  /**
   * Public list of approved experts for the mobile home screen.
   * Only experts with ExpertStatus.APPROVED are returned.
   * Returns lightweight data: name, category, bio, languages and profile photo keys.
   */
  async listDiscoverExperts() {
    const experts = await this.expertRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return {
      experts: experts
        .filter((ex) => ex.user.expertStatus === ExpertStatus.APPROVED)
        .map((ex) => {
          // Prefer profile photos stored on the user row; fall back to expert profile photos
          const photos = ex.photos ?? [];
          const profilePhoto1Key = ex.user.profilePhoto1Key ?? photos[0] ?? null;
          const profilePhoto2Key = ex.user.profilePhoto2Key ?? photos[1] ?? null;
          return {
            id: ex.user.id,
            name: ex.user.name,
            category: ex.category,
            bio: ex.bio,
            languages: ex.languagesSpoken,
            profile_photo_1_key: profilePhoto1Key,
            profile_photo_2_key: profilePhoto2Key,
            // Placeholders for price/rating; can be wired to real data later.
            price_per_minute: 20,
            rating: 4.8,
            is_online: true,
          };
        }),
    };
  }

  /**
   * Detailed public expert view for profile screen (by user id).
   */
  async getExpertPublicProfile(userId: number) {
    const ex = await this.expertRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!ex || ex.user.expertStatus !== ExpertStatus.APPROVED) {
      throw new NotFoundException('Expert not found');
    }
    const photos = ex.photos ?? [];
    const profilePhoto1Key = ex.user.profilePhoto1Key ?? photos[0] ?? null;
    const profilePhoto2Key = ex.user.profilePhoto2Key ?? photos[1] ?? null;
    return {
      id: ex.user.id,
      name: ex.user.name,
      category: ex.category,
      bio: ex.bio,
      languages: ex.languagesSpoken,
      profile_photo_1_key: profilePhoto1Key,
      profile_photo_2_key: profilePhoto2Key,
      intro_video_url: ex.introVideoUrl,
      intro_video_compressed_url: ex.introVideoCompressedUrl ?? ex.introVideoUrl,
      price_per_minute: 20,
      rating: 4.8,
      is_online: true,
    };
  }

  async listExpertRequests(): Promise<ExpertProfile[]> {
    return this.expertRepo.find({ relations: ['user'] });
  }

  async findByUserId(userId: number): Promise<ExpertProfile | null> {
    return this.expertRepo.findOne({ where: { user: { id: userId } }, relations: ['user'] });
  }
}

