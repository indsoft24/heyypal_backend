import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const PHOTOS_MAX = 5;
const PHOTOS_MIN = 2;
const PHOTO_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VIDEO_MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg', // some clients send image/jpg
  'image/png',
  'image/gif',
  'image/webp',
]);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const DOCUMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

@Injectable()
export class UploadService {
  private uploadDir: string;
  private publicBaseUrl: string;

  constructor(private config: ConfigService) {
    this.uploadDir =
      this.config.get<string>('UPLOAD_DIR') ||
      this.config.get<string>('FILE_STORAGE_PATH') ||
      './uploads';
    const apiPublic = this.config.get<string>('API_PUBLIC_URL');
    this.publicBaseUrl = apiPublic
      ? apiPublic.replace(/\/$/, '')
      : 'http://localhost:5001';
  }

  private getExt(mimetype: string): string {
    const mime = (mimetype || '').toLowerCase().split(';')[0].trim();
    return EXT_BY_MIME[mime] || 'bin';
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /** Save a buffer to a subdir with a UUID filename. Returns relative path (e.g. expert-photos/uuid.jpg). */
  async saveFile(
    subdir: 'expert-photos' | 'expert-videos' | 'expert-documents',
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    const ext = this.getExt(mimetype);
    const filename = `${uuidv4()}.${ext}`;
    const relPath = path.join(subdir, filename);
    const fullPath = path.join(this.uploadDir, relPath);
    await this.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return relPath.replace(path.sep, '/');
  }

  /** Build public URL for a relative path returned by saveFile. */
  getPublicUrl(relativePath: string): string {
    return `${this.publicBaseUrl}/uploads/${relativePath}`;
  }

  /** Validate and save multiple photo files. Returns array of public URLs. */
  async saveExpertPhotos(files: Array<{ buffer: Buffer; mimetype: string; size: number }>): Promise<string[]> {
    if (!files?.length || files.length < PHOTOS_MIN || files.length > PHOTOS_MAX) {
      throw new BadRequestException(
        `Between ${PHOTOS_MIN} and ${PHOTOS_MAX} photos required`,
      );
    }
    for (const f of files) {
      if (f.size > PHOTO_MAX_SIZE) {
        throw new BadRequestException(
          `Photo exceeds ${PHOTO_MAX_SIZE / 1024 / 1024} MB limit`,
        );
      }
      const mime = (f.mimetype || '').toLowerCase().split(';')[0].trim();
      if (!IMAGE_MIMES.has(mime)) {
        throw new BadRequestException(
          `Invalid photo type: ${f.mimetype}. Use JPEG, PNG, GIF, or WebP`,
        );
      }
    }
    const urls: string[] = [];
    for (const f of files) {
      const mime = (f.mimetype || '').toLowerCase().split(';')[0].trim();
    const rel = await this.saveFile('expert-photos', f.buffer, mime);
      urls.push(this.getPublicUrl(rel));
    }
    return urls;
  }

  /** Validate and save a single intro video. Returns public URL. */
  async saveExpertVideo(file: { buffer: Buffer; mimetype: string; size: number }): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Video file required');
    }
    if (file.size > VIDEO_MAX_SIZE) {
      throw new BadRequestException(
        `Video exceeds ${VIDEO_MAX_SIZE / 1024 / 1024} MB limit`,
      );
    }
    if (!VIDEO_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `Invalid video type: ${file.mimetype}. Use MP4 or WebM`,
      );
    }
    const rel = await this.saveFile('expert-videos', file.buffer, file.mimetype);
    return this.getPublicUrl(rel);
  }

  /** Validate and save a single document (image or PDF). Returns public URL. */
  async saveExpertDocument(file: { buffer: Buffer; mimetype: string; size: number }): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Document file required');
    }
    if (file.size > DOCUMENT_MAX_SIZE) {
      throw new BadRequestException(
        `Document exceeds ${DOCUMENT_MAX_SIZE / 1024 / 1024} MB limit`,
      );
    }
    if (!DOCUMENT_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `Invalid document type: ${file.mimetype}. Use image or PDF`,
      );
    }
    const rel = await this.saveFile(
      'expert-documents',
      file.buffer,
      file.mimetype,
    );
    return this.getPublicUrl(rel);
  }
}
