import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { ExpertVideoService } from '../media/expert-video.service';
import { SetMetadata } from '@nestjs/common';

const AdminOnly = () => SetMetadata('adminRoles', ['admin']);
const AdminOrSeller = () => SetMetadata('adminRoles', ['admin', 'seller']);

class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class CreateSellerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private expertVideo: ExpertVideoService,
  ) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Admin panel login (email/password)' })
  async login(@Body() dto: AdminLoginDto) {
    return this.admin.login(dto.email, dto.password);
  }

  @Get('experts')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List expert requests (admin only)' })
  async getExperts() {
    return this.admin.listExperts();
  }

  @Post('experts/:id/approve')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve expert (admin only)' })
  async approveExpert(@Param('id') id: string) {
    return this.admin.approveExpert(id);
  }

  @Post('experts/:id/reject')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject expert (admin only)' })
  async rejectExpert(@Param('id') id: string) {
    return this.admin.rejectExpert(id);
  }

  @Get('expert/videos/pending')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending expert intro videos (admin only)' })
  async getPendingExpertVideos() {
    return this.expertVideo.listPending();
  }

  @Post('expert/video/approve/:id')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve expert intro video (admin only)' })
  async approveExpertVideo(@Param('id') id: string) {
    return this.expertVideo.approve(id);
  }

  @Post('expert/video/reject/:id')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject expert intro video (admin only)' })
  async rejectExpertVideo(@Param('id') id: string) {
    return this.expertVideo.reject(id);
  }

  @Get('sellers')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List sellers (admin only)' })
  async getSellers() {
    return this.admin.listSellers();
  }

  @Post('sellers')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create seller (admin only)' })
  async createSeller(@Body() dto: CreateSellerDto) {
    return this.admin.createSeller(dto.name, dto.email, dto.password);
  }
}
