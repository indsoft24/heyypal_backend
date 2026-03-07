import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { ExpertVideoService } from '../media/expert-video.service';
import { CallLogService } from '../call/call-log.service';
import { CategoriesService, CreateCategoryDto, UpdateCategoryDto } from '../categories/categories.service';
import { UploadService } from '../upload/upload.service';
import { SetMetadata } from '@nestjs/common';
import { memoryStorage } from 'multer';

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
    private callLogService: CallLogService,
    private categoriesService: CategoriesService,
    private uploadService: UploadService,
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

  @Get('categories')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List categories (admin)' })
  async getCategories(@Query('search') search?: string) {
    return this.categoriesService.findForAdmin(search);
  }

  @Get('categories/:id')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get category by id (admin)' })
  async getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findById(id);
  }

  @Post('categories/upload-photo')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload category photo (admin)' })
  async uploadCategoryPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Photo file required');
    const url = await this.uploadService.saveCategoryPhoto({
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
    return { url };
  }

  @Post('categories')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create category (admin)' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('categories/:id')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category (admin)' })
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete category (admin)' })
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    await this.categoriesService.remove(id);
  }

  @Get('call-logs')
  @UseGuards(AuthGuard('jwt'), AdminRoleGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Call logs for analytics (admin only)' })
  async getCallLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('callerId') callerId?: string,
    @Query('receiverId') receiverId?: string,
  ) {
    const logs = await this.callLogService.findLogsForAdmin({
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      callerId: callerId ? parseInt(callerId, 10) : undefined,
      receiverId: receiverId ? parseInt(receiverId, 10) : undefined,
    });
    return { logs };
  }
}
