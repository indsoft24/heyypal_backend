import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';

/**
 * Stub for future Bunny CDN/storage. Same interface as VpsStorageService.
 * When ready: implement upload/delete via Bunny API, getPublicUrl from Bunny pull zone.
 * No DB change required when switching provider in StorageModule.
 */
@Injectable()
export class BunnyStorageService implements StorageProvider {
  getPublicUrl(_fileKey: string): string {
    // TODO: return Bunny pull zone URL + fileKey
    return '';
  }

  async upload(
    _buffer: Buffer,
    fileKey: string,
    _mimeType?: string,
  ): Promise<string> {
    // TODO: upload to Bunny storage, return same key
    return fileKey;
  }

  async delete(_fileKey: string): Promise<void> {
    // TODO: delete from Bunny
  }

  async getStream(_fileKey: string): Promise<Buffer | null> {
    // TODO: fetch from Bunny, return buffer
    return null;
  }
}
