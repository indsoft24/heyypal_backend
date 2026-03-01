import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

/** Abstraction for file/static storage. Replace with S3/GCS in production. */
@Injectable()
export class StorageService {
  private baseDir: string;

  constructor(private config: ConfigService) {
    this.baseDir = this.config.get<string>('FILE_STORAGE_PATH') || './storage';
  }

  async put(key: string, buffer: Buffer): Promise<string> {
    const full = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.baseDir, key));
    } catch {
      return null;
    }
  }

  getPublicUrl(key: string): string {
    const base = this.config.get<string>('STATIC_BASE_URL') || '/static';
    return `${base}/${key}`;
  }
}
