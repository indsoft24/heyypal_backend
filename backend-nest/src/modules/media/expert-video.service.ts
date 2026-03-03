import { Inject, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, ExpertStatus } from '../users/entities/user.entity';
import { ExpertVideo, ExpertVideoStatus } from './entities/expert-video.entity';
import { StorageProvider } from '../storage/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.module';
import { buildExpertVideoKey } from '../storage/key-builder';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_DURATION_SEC = 10;
const ALLOWED_MIME = 'video/mp4';

@Injectable()
export class ExpertVideoService {
  constructor(
    @InjectRepository(ExpertVideo) private videoRepo: Repository<ExpertVideo>,
    @InjectRepository(User) private userRepo: Repository<User>,
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
    if (file.mimetype !== ALLOWED_MIME) {
      throw new BadRequestException('Only MP4 allowed');
    }
    if (durationSec < 0 || durationSec > MAX_DURATION_SEC) {
      throw new BadRequestException(`Duration must be 0–${MAX_DURATION_SEC} seconds`);
    }

    const videoKey = buildExpertVideoKey(userId);
    await this.storage.upload(file.buffer, videoKey, file.mimetype);

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
    return video;
  }

  async reject(id: string): Promise<ExpertVideo> {
    const video = await this.videoRepo.findOne({ where: { id } });
    if (!video) throw new BadRequestException('Video not found');
    video.status = ExpertVideoStatus.REJECTED;
    await this.videoRepo.save(video);
    return video;
  }
}
