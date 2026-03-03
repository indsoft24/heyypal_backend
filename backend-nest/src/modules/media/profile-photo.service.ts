import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StorageProvider } from '../storage/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.module';
import { buildUserProfilePhotoKey } from '../storage/key-builder';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png']);

@Injectable()
export class ProfilePhotoService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  async uploadProfilePhotos(
    userId: number,
    files: Array<{ buffer: Buffer; mimetype: string; size: number }>,
  ): Promise<{ keys: string[] }> {
    if (!files?.length || files.length > 2) {
      throw new BadRequestException('Max 2 profile photos allowed');
    }
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        throw new BadRequestException('Each photo max 5 MB');
      }
      if (!ALLOWED_MIMES.has(f.mimetype)) {
        throw new BadRequestException('Only JPEG or PNG allowed');
      }
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const keys: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const index = (i + 1) as 1 | 2;
      const key = buildUserProfilePhotoKey(userId, index);
      await this.storage.upload(files[i].buffer, key, files[i].mimetype);
      keys.push(key);
    }

    if (keys.length >= 1) user.profilePhoto1Key = keys[0];
    if (keys.length >= 2) user.profilePhoto2Key = keys[1];
    await this.userRepo.save(user);

    return { keys };
  }

  getPublicUrls(user: User): string[] {
    const urls: string[] = [];
    if (user.profilePhoto1Key) urls.push(this.storage.getPublicUrl(user.profilePhoto1Key));
    if (user.profilePhoto2Key) urls.push(this.storage.getPublicUrl(user.profilePhoto2Key));
    return urls;
  }
}
