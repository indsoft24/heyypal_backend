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
import { CallSessionService } from './call-session.service';
import { PresenceService } from './presence.service';
import { CallStatus } from './entities/call-log.entity';

class InitiateCallDto {
  @IsInt()
  receiverId: number;
}

class EndCallDto {
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
    private readonly callSessionService: CallSessionService,
    private readonly presenceService: PresenceService,
  ) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Check if receiver is available; actual call via WebSocket call:initiate' })
  async initiate(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiateCallDto,
  ) {
    const available = await this.presenceService.isUserAvailable(dto.receiverId);
    if (!available) {
      return { ok: false, busy: true, message: 'Receiver is busy' };
    }
    return { ok: true, busy: false, message: 'Use WebSocket namespace /call and emit call:initiate with { receiverId }' };
  }

  @Post('end')
  @ApiOperation({ summary: 'End an ongoing call' })
  async end(
    @CurrentUser('userId') userId: string,
    @Body() dto: EndCallDto,
  ) {
    const uid = parseInt(userId, 10);
    const session = await this.callSessionService.findBySessionId(dto.callSessionId);
    if (!session) return { ok: false, message: 'Session not found' };
    if (session.callerId !== uid && session.receiverId !== uid) {
      return { ok: false, message: 'Not participant' };
    }
    await this.callSessionService.setEnded(dto.callSessionId, 'ended');
    await this.callSessionService.deleteBySessionId(dto.callSessionId);
    const startTime = session.callStatus === 'connected' ? session.createdAt : null;
    const endTime = new Date();
    const durationSeconds = startTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : 0;
    const log = await this.callLogService.findBySessionId(dto.callSessionId);
    if (log) {
      await this.callLogService.updateEnd(
        dto.callSessionId,
        endTime,
        CallStatus.ENDED,
        durationSeconds,
      );
    }
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
