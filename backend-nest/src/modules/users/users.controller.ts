import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

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
    if (!user) return null;
    return this.users.toMeDto(user);
  }

  @Get('me/profile-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfileStatus(@CurrentUser('userId') userId: string) {
    return this.users.getProfileStatus(userId);
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
      return this.users.toMeDto(user);
    } catch (err) {
      this.logger.error(`profile/complete failed userId=${userId}`, (err as Error)?.stack ?? err);
      throw err;
    }
  }
}
