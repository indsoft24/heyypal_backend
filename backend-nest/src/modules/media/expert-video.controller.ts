import {
  BadRequestException,
  Body,
  Controller,
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
  constructor(private expertVideo: ExpertVideoService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('video', { storage: memory }))
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
  @ApiOperation({ summary: 'Upload expert intro video (max 10 sec, 50 MB, MP4). Status = pending until admin approves.' })
  async upload(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Video file required');
    const duration = dto.duration ?? 0;
    const result = await this.expertVideo.uploadIntroVideo(
      Number(userId),
      { buffer: file.buffer, mimetype: file.mimetype, size: file.size },
      duration,
    );
    return result;
  }
}
