import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ArrayNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpertsService } from './experts.service';
import { ExpertCategory } from './entities/expert-profile.entity';
import { ExpertType } from '../users/entities/user.entity';

class SubmitExpertProfileDto {
  @IsEnum(ExpertType)
  type: ExpertType;

  @IsEnum(ExpertCategory)
  category: ExpertCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  bio: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  languagesSpoken: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  photos: string[];

  @IsString()
  @IsNotEmpty()
  introVideoUrl: string;

  @IsOptional()
  @IsString()
  introVideoCompressedUrl?: string;

  @IsOptional()
  @IsString()
  degreeCertificateUrl?: string;

  @IsOptional()
  @IsString()
  aadharUrl?: string;
}

@ApiTags('experts')
@Controller('experts')
export class ExpertsController {
  constructor(private experts: ExpertsService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Submit expert application (supportive/professional) with bio, category, media, and documents',
  })
  async submitProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitExpertProfileDto,
  ) {
    return this.experts.submitExpertProfile(Number(userId), dto);
  }
}

