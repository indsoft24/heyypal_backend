import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StorageProvider } from '../storage/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.module';
import { isAllowedKey } from '../storage/key-builder';
import { ProfilePhotoService } from './profile-photo.service';

const memory = memoryStorage();

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    private profilePhoto: ProfilePhotoService,
  ) {}

  @Post('profile/upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'photos', maxCount: 2 }], { storage: memory }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload up to 2 profile photos (User or Expert). Returns keys.' })
  async uploadProfilePhotos(
    @CurrentUser('userId') userId: string,
    @UploadedFiles() files: { photos?: Express.Multer.File[] },
  ) {
    const photos = files?.photos;
    if (!photos?.length) throw new BadRequestException('At least one photo required');
    const payload = photos.map((f) => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
      size: f.size,
    }));
    const { keys } = await this.profilePhoto.uploadProfilePhotos(Number(userId), payload);
    const urls = keys.map((k) => this.storage.getPublicUrl(k));
    return { keys, urls };
  }

  @Get('*')
  @ApiOperation({ summary: 'Serve file by key (e.g. profile/user/1/photo1.jpg). No auth for public read.' })
  async serveByKey(@Req() req: { path: string }, @Res() res: Response) {
    const key = req.path.replace(/^\/api\/media\/?/, '').replace(/^\/media\/?/, '').replace(/^\//, '');
    const decoded = decodeURIComponent(key);
    if (!isAllowedKey(decoded)) {
      throw new BadRequestException('Invalid key');
    }
    const buffer = await this.storage.getStream(decoded);
    if (!buffer) {
      return res.status(404).send('Not found');
    }
    const ext = decoded.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'mp4'
            ? 'video/mp4'
            : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.send(buffer);
  }
}
