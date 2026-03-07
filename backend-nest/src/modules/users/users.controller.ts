import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';

const PROFILE_PHOTO_MAX = 10 * 1024 * 1024; // 10 MB
const multerMemory = memoryStorage();

class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateOfBirth?: string;

  /** Alternative key for clients that send snake_case */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  date_of_birth?: string;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser('userId') userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    const stats = await this.users.getProfileStats(Number(userId));
    return this.users.toMeDto(user, stats);
  }

  @Get('profile-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfileStats(@CurrentUser('userId') userId: string) {
    return this.users.getProfileStats(Number(userId));
  }

  @Get('me/profile-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfileStatus(@CurrentUser('userId') userId: string) {
    return this.users.getProfileStatus(userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: multerMemory,
      limits: { fileSize: PROFILE_PHOTO_MAX },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        gender: { type: 'string' },
        dateOfBirth: { type: 'string' },
        profilePhoto: { type: 'string', format: 'binary' },
      },
    },
  })
  async updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMeDto,
    @UploadedFile() profilePhoto?: Express.Multer.File,
  ) {
    const file = profilePhoto?.buffer
      ? { buffer: profilePhoto.buffer, mimetype: profilePhoto.mimetype, size: profilePhoto.size }
      : undefined;
    const user = await this.users.updateMe(userId, dto, file);
    const stats = await this.users.getProfileStats(Number(userId));
    return this.users.toMeDto(user, stats);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSessions(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const l = Math.min(Math.max(1, Number(limit) || 20), 100);
    const o = Math.max(0, Number(offset) || 0);
    return this.users.getSessions(Number(userId), l, o);
  }

  @Get('preferences/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getNotificationPreferences(@CurrentUser('userId') userId: string) {
    return this.users.getNotificationPreferences(Number(userId));
  }

  @Put('preferences/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateNotificationPreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: NotificationPreferencesDto,
  ) {
    return this.users.updateNotificationPreferences(Number(userId), dto);
  }

  @Post('profile/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async completeProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteProfileDto,
  ) {
    this.logger.log(`profile/complete called userId=${userId} name=${dto.name} role=${dto.role}`);
    try {
      const user = await this.users.completeProfile(userId, dto);
      this.logger.log(`profile/complete success userId=${userId}`);
      const stats = await this.users.getProfileStats(Number(userId));
      return this.users.toMeDto(user, stats);
    } catch (err) {
      this.logger.error(`profile/complete failed userId=${userId}`, (err as Error)?.stack ?? err);
      throw err;
    }
  }

  @Post('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateFcmToken(
    @CurrentUser('userId') userId: string,
    @Body('token') token: string,
  ) {
    if (!token) {
      return { success: false, message: 'Token is required' };
    }
    await this.users.updateFcmToken(Number(userId), token);
    return { success: true };
  }
}
