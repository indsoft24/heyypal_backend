import {
    Controller,
    Get,
    Query,
    Param,
    UseGuards,
    Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get('messages/:peerId')
    async getMessages(
        @CurrentUser('userId') userId: string,
        @Param('peerId') peerId: string,
        @Query('limit') limit = 50,
        @Query('offset') offset = 0,
    ) {
        return this.chatService.getMessages(
            Number(userId),
            Number(peerId),
            limit,
            offset,
        );
    }

    @Post('messages/:peerId/read')
    async markAsRead(
        @CurrentUser('userId') userId: string,
        @Param('peerId') peerId: string,
    ) {
        await this.chatService.markAsRead(Number(userId), Number(peerId));
        return { success: true };
    }

    @Get('list')
    async getChatList(
        @CurrentUser('userId') userId: string,
    ) {
        return this.chatService.getChatList(Number(userId));
    }
}
