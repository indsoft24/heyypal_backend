import { Inject, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, ExpertStatus } from '../users/entities/user.entity';
import { ExpertVideo, ExpertVideoStatus } from './entities/expert-video.entity';
import { ExpertProfile } from '../experts/entities/expert-profile.entity';
import { StorageProvider } from '../storage/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.module';
import { buildExpertVideoKey } from '../storage/key-builder';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_DURATION_SEC = 10;
/** Android MediaRecorder can send video/mp4, video/3gpp, or video/mp4v-es depending on device. */
const ALLOWED_MIMES = ['video/mp4', 'video/3gpp', 'video/mp4v-es', 'video/x-mp4'];

@Injectable()
export class ExpertVideoService {
  constructor(
    @InjectRepository(ExpertVideo) private videoRepo: Repository<ExpertVideo>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(ExpertProfile) private expertProfileRepo: Repository<ExpertProfile>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async uploadIntroVideo(
    userId: number,
    file: { buffer: Buffer; mimetype: string; size: number },
    durationSec: number,
  ): Promise<{ id: string; videoKey: string; status: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (user.role !== UserRole.EXPERT) {
      throw new ForbiddenException('Only experts can upload intro video');
    }

    if (!file?.buffer?.length) throw new BadRequestException('Video file required');
    if (file.size > MAX_SIZE) throw new BadRequestException('Video max 50 MB');
    const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException(`Unsupported video type: ${file.mimetype || 'unknown'}. Use MP4 or 3GP.`);
    }
    if (durationSec < 0 || durationSec > MAX_DURATION_SEC) {
      throw new BadRequestException(`Duration must be 0–${MAX_DURATION_SEC} seconds`);
    }

    const videoKey = buildExpertVideoKey(userId);
    await this.storage.upload(file.buffer, videoKey, 'video/mp4');

    const expertVideo = this.videoRepo.create({
      userId,
      videoKey,
      thumbnailKey: null,
      duration: durationSec,
      status: ExpertVideoStatus.PENDING,
    });
    await this.videoRepo.save(expertVideo);

    return {
      id: expertVideo.id,
      videoKey: expertVideo.videoKey,
      status: expertVideo.status,
    };
  }

  async listPending(): Promise<Array<{ videoUrl: string } & Record<string, unknown>>> {
    const list = await this.videoRepo.find({
      where: { status: ExpertVideoStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return list.map((v) => ({
      ...v,
      videoUrl: this.storage.getPublicUrl(v.videoKey),
    }));
  }

  async approve(id: string): Promise<ExpertVideo> {
    const video = await this.videoRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!video) throw new BadRequestException('Video not found');
    video.status = ExpertVideoStatus.APPROVED;
    video.approvedAt = new Date();
    await this.videoRepo.save(video);
    const user = video.user;
    user.expertStatus = ExpertStatus.APPROVED;
    await this.userRepo.save(user);
    // Copy approved video URL to expert profile so admin and app show intro video
    const profile = await this.expertProfileRepo.findOne({
      where: { user: { id: video.userId } },
    });
    if (profile) {
      profile.introVideoUrl = this.storage.getPublicUrl(video.videoKey);
      if (!profile.introVideoCompressedUrl) profile.introVideoCompressedUrl = profile.introVideoUrl;
      await this.expertProfileRepo.save(profile);
    }
    return video;
  }

  async reject(id: string): Promise<ExpertVideo> {
    const video = await this.videoRepo.findOne({ where: { id } });
    if (!video) throw new BadRequestException('Video not found');
    video.status = ExpertVideoStatus.REJECTED;
    await this.videoRepo.save(video);
    return video;
  }

  /** Approved intro video URL per user id (for admin fallback when profile has no URL). */
  async getApprovedVideoUrlsByUser(): Promise<Map<number, string>> {
    const list = await this.videoRepo.find({
      where: { status: ExpertVideoStatus.APPROVED },
      order: { approvedAt: 'DESC' },
    });
    const map = new Map<number, string>();
    for (const v of list) {
      if (!map.has(v.userId)) map.set(v.userId, this.storage.getPublicUrl(v.videoKey));
    }
    return map;
  }
}
