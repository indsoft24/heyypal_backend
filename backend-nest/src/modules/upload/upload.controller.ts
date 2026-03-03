import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { memoryStorage } from 'multer';

/** File from multer memory storage (buffer, mimetype, size). */
interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const PHOTOS_MIN = 2;
const PHOTOS_MAX = 5;
const PHOTO_MAX_SIZE = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE = 15 * 1024 * 1024;
const DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

const multerMemory = memoryStorage();

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('expert/photos')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload 2–5 expert photos (max 10 MB each)' })
  @UseInterceptors(
    FilesInterceptor('photos', PHOTOS_MAX, {
      storage: multerMemory,
      limits: { fileSize: PHOTO_MAX_SIZE },
    }),
  )
  async uploadExpertPhotos(
    @UploadedFiles() files: UploadedFile[],
  ): Promise<{ urls: string[] }> {
    if (!files?.length) {
      throw new BadRequestException(
        `Field "photos" required: 2–5 image files (JPEG, PNG, GIF, WebP), max 10 MB each`,
      );
    }
    const urls = await this.uploadService.saveExpertPhotos(files);
    return { urls };
  }

  @Post('expert/video')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload intro video (max 15 MB)' })
  @UseInterceptors(
    FileInterceptor('video', {
      storage: multerMemory,
      limits: { fileSize: VIDEO_MAX_SIZE },
    }),
  )
  async uploadExpertVideo(
    @UploadedFile() file: UploadedFile,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException(
        'Field "video" required: one video file (MP4 or WebM), max 15 MB',
      );
    }
    const url = await this.uploadService.saveExpertVideo(file);
    return { url };
  }

  @Post('expert/document')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload degree/certificate or Aadhaar (image or PDF, max 10 MB)' })
  @UseInterceptors(
    FileInterceptor('document', {
      storage: multerMemory,
      limits: { fileSize: DOCUMENT_MAX_SIZE },
    }),
  )
  async uploadExpertDocument(
    @UploadedFile() file: UploadedFile,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException(
        'Field "document" required: image or PDF, max 10 MB',
      );
    }
    const url = await this.uploadService.saveExpertDocument(file);
    return { url };
  }
}
