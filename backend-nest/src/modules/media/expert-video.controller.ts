import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpertVideoService } from './expert-video.service';

const VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const memory = memoryStorage();

class UploadVideoDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  duration?: number;
}

@ApiTags('expert-video')
@Controller('expert/video')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExpertVideoController {
  private readonly logger = new Logger(ExpertVideoController.name);

  constructor(private expertVideo: ExpertVideoService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memory,
      limits: { fileSize: VIDEO_MAX_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: { type: 'string', format: 'binary' },
        duration: { type: 'number', description: 'Duration in seconds (0–10)' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload expert intro video (max 10 sec, 50 MB, MP4/3GP). Status = pending until admin approves.' })
  async upload(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
  ) {
    this.logger.log(`expert/video/upload called userId=${userId} hasFile=${!!file} mimetype=${file?.mimetype} size=${file?.size}`);
    if (!file?.buffer?.length) {
      this.logger.warn(`expert/video/upload rejected: no file (field must be "video")`);
      throw new BadRequestException('Video file required. Use form field name "video".');
    }
    const duration = dto.duration ?? 0;
    try {
      const result = await this.expertVideo.uploadIntroVideo(
        Number(userId),
        { buffer: file.buffer, mimetype: file.mimetype, size: file.size },
        duration,
      );
      this.logger.log(`expert/video/upload success userId=${userId} id=${result.id}`);
      return result;
    } catch (err) {
      this.logger.error(`expert/video/upload failed userId=${userId}`, (err as Error)?.stack ?? err);
      throw err;
    }
  }
}
