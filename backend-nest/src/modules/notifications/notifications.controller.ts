import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
import { SendChatPushDto } from './dto/send-chat.dto';
import { SendCallPushDto } from './dto/send-call.dto';
import { CancelCallPushDto } from './dto/cancel-call.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('send-chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async sendChat(@Body() dto: SendChatPushDto) {
    const user = await this.usersService.findById(dto.receiverUserId);
    if (!user?.fcmToken) {
      return { success: false, message: 'User has no FCM token' };
    }
    await this.notificationsService.sendChatMessagePush(user.fcmToken, {
      conversationId: dto.conversationId ?? '',
      senderId: dto.senderId,
      senderName: dto.senderName,
      message: dto.message,
      messageId: dto.messageId,
    });
    return { success: true };
  }

  @Post('send-call')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async sendCall(@Body() dto: SendCallPushDto) {
    const user = await this.usersService.findById(dto.receiverUserId);
    if (!user?.fcmToken) {
      return { success: false, message: 'User has no FCM token' };
    }
    await this.notificationsService.sendIncomingCallPush(user.fcmToken, {
      callSessionId: dto.callId,
      callerId: dto.callerId,
      channelName: dto.channelName,
      callerName: dto.callerName,
      agoraToken: dto.agoraToken,
      uid: dto.uid,
    });
    return { success: true };
  }

  @Post('cancel-call')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async cancelCall(@Body() dto: CancelCallPushDto) {
    const user = await this.usersService.findById(dto.receiverUserId);
    if (!user?.fcmToken) {
      return { success: false, message: 'User has no FCM token' };
    }
    await this.notificationsService.sendCallCancelledPush(user.fcmToken, dto.callSessionId);
    return { success: true };
  }
}
