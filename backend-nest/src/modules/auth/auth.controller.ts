import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private auth: AuthService,
    private users: UsersService,
  ) { }

  @Post('google')
  @ApiOperation({ summary: 'Login with Google ID token' })
  async google(@Body() dto: GoogleLoginDto) {
    try {
      return await this.auth.loginWithGoogle(dto.idToken);
    } catch (e) {
      this.logger.error(`Google login exception: ${e.message}`, e.stack);
      throw e;
    }
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('profile/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete user profile (name, phone, role)' })
  async completeProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteProfileDto,
  ) {
    this.logger.log(`profile/complete called userId=${userId} name=${dto.name} role=${dto.role}`);
    try {
      const user = await this.users.completeProfile(userId, dto);
      this.logger.log(`profile/complete success userId=${userId}`);
      return user;
    } catch (err) {
      this.logger.error(`profile/complete failed userId=${userId}`, (err as Error)?.stack ?? err);
      throw err;
    }
  }
}
