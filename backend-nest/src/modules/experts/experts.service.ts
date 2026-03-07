import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpertProfile } from './entities/expert-profile.entity';
import { User, ExpertStatus, ExpertType } from '../users/entities/user.entity';
import { ExpertVideo, ExpertVideoStatus } from '../media/entities/expert-video.entity';
import { CategoriesService } from '../categories/categories.service';

export interface ExpertOnboardingStatusDto {
  onboardingComplete: boolean;
  hasProfile?: boolean;
  hasPhotos?: boolean;
  hasIntroVideo?: boolean;
  hasDegreeCertificate?: boolean;
  hasAadhar?: boolean;
}

@Injectable()
export class ExpertsService {
  private readonly publicBaseUrl: string;

  constructor(
    @InjectRepository(ExpertProfile) private expertRepo: Repository<ExpertProfile>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ExpertVideo) private expertVideoRepo: Repository<ExpertVideo>,
    private config: ConfigService,
    private categoriesService: CategoriesService,
  ) {
    const base = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:5001';
    this.publicBaseUrl = base.replace(/\/$/, '');
  }

  /** Resolve profile photo key to full public URL (same logic as UsersService.getProfilePicUrl). */
  private toProfilePhotoUrl(key: string | null): string | null {
    if (!key?.trim()) return null;
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `${this.publicBaseUrl}/uploads/${key.replace(/^\/+/, '')}`;
  }

  /**
   * Returns whether the expert has completed step 3 (final step): profile with
   * photos, intro video, and for professional type: degree certificate + aadhar.
   * Used by the app to gate access; backend is source of truth.
   */
  async getOnboardingStatus(userId: number): Promise<ExpertOnboardingStatusDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'expert') {
      return { onboardingComplete: true };
    }

    const profile = await this.expertRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!profile) {
      return {
        onboardingComplete: false,
        hasProfile: false,
        hasPhotos: false,
        hasIntroVideo: false,
        hasDegreeCertificate: false,
        hasAadhar: false,
      };
    }

    const hasPhotos =
      (profile.photos?.length ?? 0) >= 2 ||
      !!(profile.user.profilePhoto1Key && profile.user.profilePhoto2Key);

    const hasIntroVideoFromProfile = !!(
      profile.introVideoUrl?.trim() || profile.introVideoCompressedUrl?.trim()
    );
    const approvedVideo = await this.expertVideoRepo.findOne({
      where: { userId, status: ExpertVideoStatus.APPROVED },
    });
    const hasIntroVideo = !!hasIntroVideoFromProfile || !!approvedVideo;

    const isProfessional = profile.type === ExpertType.PROFESSIONAL;
    const hasDegreeCertificate = !isProfessional || !!(profile.degreeCertificateUrl?.trim());
    const hasAadhar = !isProfessional || !!(profile.aadharUrl?.trim());

    const onboardingComplete =
      hasPhotos && hasIntroVideo && hasDegreeCertificate && hasAadhar;

    return {
      onboardingComplete,
      hasProfile: true,
      hasPhotos,
      hasIntroVideo,
      hasDegreeCertificate,
      hasAadhar,
    };
  }

  async submitExpertProfile(userId: number, payload: {
    type: ExpertType;
    categoryId: number;
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

    // Step 3 validation: photos (min 2), intro video (submitted or already uploaded), and for professional: degree + aadhar
    if (!payload.photos?.length || payload.photos.length < 2) {
      throw new BadRequestException('At least 2 photos are required');
    }
    const introUrl = payload.introVideoUrl?.trim() || null;
    const introCompressed = payload.introVideoCompressedUrl?.trim() || introUrl;
    const hasIntroInPayload = !!(introUrl || introCompressed);
    const hasUploadedVideo = await this.expertVideoRepo
      .createQueryBuilder('v')
      .where('v.user_id = :userId', { userId })
      .getCount()
      .then((c) => c > 0);
    if (!hasIntroInPayload && !hasUploadedVideo) {
      throw new BadRequestException('Intro video is required. Please record and upload your intro video first.');
    }
    if (payload.type === ExpertType.PROFESSIONAL) {
      if (!payload.degreeCertificateUrl?.trim()) {
        throw new BadRequestException('Degree/certificate document is required for professional experts');
      }
      if (!payload.aadharUrl?.trim()) {
        throw new BadRequestException('Aadhar document is required for professional experts');
      }
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

    const category = await this.categoriesService.findById(payload.categoryId);
    const profile = this.expertRepo.create({
      user,
      type: payload.type,
      category: category.name,
      bio: payload.bio,
      languagesSpoken: payload.languagesSpoken,
      photos: payload.photos,
      introVideoUrl: introUrl,
      introVideoCompressedUrl: introCompressed,
      degreeCertificateUrl: payload.degreeCertificateUrl?.trim() || null,
      aadharUrl: payload.aadharUrl?.trim() || null,
    });

    return this.expertRepo.save(profile);
  }

  /**
   * Public list of approved experts with optional category filter and pagination.
   * categoryId undefined = "All" (no filter). Returns { experts, total, page, limit, totalPages }.
   */
  async listDiscoverExpertsPaginated(
    categoryId: number | undefined,
    page: number,
    limit: number,
  ) {
    const qb = this.expertRepo
      .createQueryBuilder('ex')
      .innerJoinAndSelect('ex.user', 'user')
      .where('user.expert_status = :status', { status: ExpertStatus.APPROVED })
      .orderBy('ex.createdAt', 'DESC');

    if (categoryId != null) {
      const category = await this.categoriesService.findById(categoryId);
      qb.andWhere('ex.category = :categoryName', { categoryName: category.name });
    }

    const total = await qb.getCount();
    const experts = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      experts: experts.map((ex) => {
        const photos = ex.photos ?? [];
        const profilePhoto1Key = ex.user.profilePhoto1Key ?? photos[0] ?? null;
        const profilePhoto2Key = ex.user.profilePhoto2Key ?? photos[1] ?? null;
        return {
          id: ex.user.id,
          name: ex.user.name ?? '',
          category: ex.category ?? '',
          bio: ex.bio ?? '',
          languages: ex.languagesSpoken ?? [],
          profile_photo_1_key: this.toProfilePhotoUrl(profilePhoto1Key),
          profile_photo_2_key: this.toProfilePhotoUrl(profilePhoto2Key),
          price_per_minute: 20,
          rating: 4.8,
          is_online: true,
        };
      }),
      total,
      page,
      limit,
      totalPages,
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
      name: ex.user.name ?? '',
      category: ex.category ?? '',
      bio: ex.bio ?? '',
      languages: ex.languagesSpoken ?? [],
      profile_photo_1_key: this.toProfilePhotoUrl(profilePhoto1Key),
      profile_photo_2_key: this.toProfilePhotoUrl(profilePhoto2Key),
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

