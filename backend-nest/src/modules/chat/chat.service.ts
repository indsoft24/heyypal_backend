import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @InjectRepository(Message)
        private readonly messageRepo: Repository<Message>,
        private readonly usersService: UsersService,
        private readonly notificationsService: NotificationsService,
    ) { }

    async sendMessage(senderId: number, dto: SendMessageDto) {
        const receiver = await this.usersService.findById(dto.receiverId);
        if (!receiver) {
            this.logger.warn(`Receiver ${dto.receiverId} not found`);
            throw new Error('Receiver not found');
        }

        const sender = await this.usersService.findById(senderId);
        if (!sender) {
            this.logger.warn(`Sender ${senderId} not found`);
            throw new Error('Sender not found');
        }

        const message = this.messageRepo.create({
            senderId,
            receiverId: dto.receiverId,
            content: dto.content,
        });

        const savedMessage = await this.messageRepo.save(message);

        if (receiver.fcmToken) {
            await this.notificationsService.sendPushNotification(
                receiver.fcmToken,
                sender.name || 'HeyyPal User',
                dto.content,
                {
                    type: 'chat',
                    senderId: senderId.toString(),
                    messageId: savedMessage.id.toString(),
                },
            );
        }

        return savedMessage;
    }

    async getMessages(userId: number, peerId: number, limit = 50, offset = 0) {
        return this.messageRepo.find({
            where: [
                { senderId: userId, receiverId: peerId },
                { senderId: peerId, receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
            relations: ['sender', 'receiver'],
        });
    }

    async markAsRead(userId: number, peerId: number) {
        await this.messageRepo.update(
            { senderId: peerId, receiverId: userId, isRead: false },
            { isRead: true },
        );
    }
}
