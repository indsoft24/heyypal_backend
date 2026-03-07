import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ArrayNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpertsService } from './experts.service';
import { ExpertType } from '../users/entities/user.entity';

class SubmitExpertProfileDto {
  @IsEnum(ExpertType)
  type: ExpertType;

  @IsNumber()
  @IsInt()
  @Min(1)
  categoryId: number;

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

  @IsOptional()
  @IsString()
  introVideoUrl?: string;

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

  @Get('me/onboarding-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get expert onboarding (step 3) completion status from database; app gates on this',
  })
  async getOnboardingStatus(@CurrentUser('userId') userId: string) {
    return this.experts.getOnboardingStatus(Number(userId));
  }

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

  @Get('discover')
  @ApiOperation({
    summary: 'Public list of approved experts with optional category filter and pagination',
  })
  async discover(
    @Query('categoryId') categoryId?: string,
    @Query('page') @Type(() => Number) page = 1,
    @Query('limit') @Type(() => Number) limit = 20,
  ) {
    const catId = categoryId ? parseInt(categoryId, 10) : undefined;
    const p = Math.max(1, Number.isFinite(page) ? page : 1);
    const l = Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 20));
    return this.experts.listDiscoverExpertsPaginated(catId, p, l);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Public expert profile details by user id',
  })
  async detail(@Param('id') id: string) {
    return this.experts.getExpertPublicProfile(Number(id));
  }
}

