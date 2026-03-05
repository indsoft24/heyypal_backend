import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgoraService, AgoraRole } from './agora.service';

class CreateRtcTokenDto {
  @IsString()
  channelName: string;

  @IsInt()
  @Min(1)
  userId: number;

  @IsEnum(['publisher', 'subscriber'], {
    message: 'role must be publisher or subscriber',
  })
  role: AgoraRole;

  @IsInt()
  @Min(60)
  expireSeconds?: number;
}

@ApiTags('agora')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agora')
export class AgoraController {
  constructor(private readonly agoraService: AgoraService) {}

  @Post('rtc-token')
  @ApiOperation({ summary: 'Generate Agora RTC token for 1-1 audio call' })
  createRtcToken(@Body() dto: CreateRtcTokenDto) {
    const { channelName, userId, role, expireSeconds } = dto;
    return this.agoraService.generateRtcToken({ channelName, userId, role, expireSeconds });
  }
}

