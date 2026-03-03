import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from './storage-provider.interface';

import { isAllowedKey } from './key-builder';

@Injectable()
export class VpsStorageService implements StorageProvider {
  private readonly root: string;
  private readonly publicBase: string;

  constructor(private config: ConfigService) {
    this.root =
      this.config.get<string>('STORAGE_ROOT') ||
      this.config.get<string>('UPLOAD_DIR') ||
      path.join(process.cwd(), 'storage');
    const apiPublic = this.config.get<string>('API_PUBLIC_URL') || 'http://localhost:5001';
    this.publicBase = apiPublic.replace(/\/$/, '') + '/api/media';
  }

  getPublicUrl(fileKey: string): string {
    if (!fileKey || !isAllowedKey(fileKey)) {
      return '';
    }
    return `${this.publicBase}/${encodeURIComponent(fileKey)}`;
  }

  async upload(
    buffer: Buffer,
    fileKey: string,
    _mimeType?: string,
  ): Promise<string> {
    if (!fileKey || !isAllowedKey(fileKey)) {
      throw new Error('Invalid file key');
    }
    const safeKey = fileKey.replace(/\.\./g, '');
    const fullPath = path.join(this.root, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return safeKey;
  }

  async delete(fileKey: string): Promise<void> {
    if (!fileKey || !isAllowedKey(fileKey)) return;
    const fullPath = path.join(this.root, fileKey.replace(/\.\./g, ''));
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore not found
    }
  }

  async getStream(fileKey: string): Promise<Buffer | null> {
    if (!fileKey || !isAllowedKey(fileKey)) return null;
    const fullPath = path.join(this.root, fileKey.replace(/\.\./g, ''));
    try {
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }
}
