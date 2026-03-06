import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CallLogService } from './call-log.service';
import { CallService } from './call.service';

class InitiateCallDto {
  @IsInt()
  receiverId: number;
}

class CallSessionDto {
  @IsString()
  callSessionId: string;
}

@ApiTags('call')
@Controller('call')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallController {
  constructor(
    private readonly callLogService: CallLogService,
    private readonly callService: CallService,
  ) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate 1-1 call: creates session, sends FCM to receiver, returns Agora token for caller' })
  async initiate(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiateCallDto,
  ) {
    const callerId = parseInt(userId, 10);
    const { busy, result } = await this.callService.initiate(callerId, dto.receiverId);
    if (busy) {
      return { ok: false, busy: true, message: 'Receiver is busy' };
    }
    return { ok: true, busy: false, ...result };
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept incoming call; returns Agora token for callee' })
  async accept(
    @CurrentUser('userId') userId: string,
    @Body() dto: CallSessionDto,
  ) {
    const receiverId = parseInt(userId, 10);
    const { ok, result, message } = await this.callService.accept(receiverId, dto.callSessionId);
    if (!ok) return { ok: false, message: message ?? 'Accept failed' };
    return { ok: true, ...result };
  }

  @Post('reject')
  @ApiOperation({ summary: 'Reject incoming call' })
  async reject(
    @CurrentUser('userId') userId: string,
    @Body() dto: CallSessionDto,
  ) {
    const receiverId = parseInt(userId, 10);
    const { ok, message } = await this.callService.reject(receiverId, dto.callSessionId);
    if (!ok) return { ok: false, message: message ?? 'Reject failed' };
    return { ok: true };
  }

  @Post('end')
  @ApiOperation({ summary: 'End an ongoing call' })
  async end(
    @CurrentUser('userId') userId: string,
    @Body() dto: CallSessionDto,
  ) {
    const uid = parseInt(userId, 10);
    const { ok, message } = await this.callService.end(uid, dto.callSessionId);
    if (!ok) return { ok: false, message: message ?? 'End failed' };
    return { ok: true };
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get call logs for current user' })
  async logs(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const uid = parseInt(userId, 10);
    const logs = await this.callLogService.findLogsByUser(uid, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return { logs };
  }
}
