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
        this.logger.debug(`sendMessage: senderId=${senderId}, receiverId=${dto.receiverId}, contentLen=${dto.content.length}`);

        try {
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
            this.logger.log(`Message stored: id=${savedMessage.id}, sender=${senderId}, receiver=${dto.receiverId}`);

            if (receiver.fcmToken) {
                await this.notificationsService.sendChatPush(
                    receiver.fcmToken,
                    {
                        senderId: senderId.toString(),
                        senderName: sender.name || 'HeyyPal User',
                        content: dto.content,
                        messageId: savedMessage.id.toString(),
                    },
                );
            }
            return savedMessage;
        } catch (error) {
            this.logger.error(`Failed to send/store message: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getMessages(userId: number, peerId: number, limit = 50, offset = 0) {
        const [data, total] = await this.messageRepo.findAndCount({
            where: [
                { senderId: userId, receiverId: peerId },
                { senderId: peerId, receiverId: userId },
            ],
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
            relations: ['sender', 'receiver'],
        });
        return { data, total };
    }

    async markAsRead(userId: number, peerId: number) {
        await this.messageRepo.update(
            { senderId: peerId, receiverId: userId, isRead: false },
            { isRead: true, isDelivered: true },
        );
    }

    async markAsDelivered(userId: number, peerId: number) {
        await this.messageRepo.update(
            { senderId: peerId, receiverId: userId, isDelivered: false },
            { isDelivered: true },
        );
    }

    async markMessageDelivered(messageId: number) {
        await this.messageRepo.update(messageId, { isDelivered: true });
    }

    async getChatList(userId: number) {
        const messages = await this.messageRepo.createQueryBuilder('m')
            .where('m.senderId = :userId OR m.receiverId = :userId', { userId })
            .orderBy('m.createdAt', 'DESC')
            .getMany();

        const map = new Map<number, any>();

        for (const m of messages) {
            const isSender = m.senderId === userId;
            const peerId = isSender ? m.receiverId : m.senderId;

            if (!map.has(peerId)) {
                map.set(peerId, {
                    peerId,
                    latestMessage: m.content,
                    time: m.createdAt,
                    unreadCount: 0,
                });
            }

            if (!isSender && !m.isRead) {
                map.get(peerId).unreadCount++;
            }
        }

        const chatList = [];
        for (const [peerId, data] of map.entries()) {
            const peerUser = await this.usersService.findById(peerId);
            if (peerUser) {
                chatList.push({
                    peerId: peerId,
                    peerName: peerUser.name,
                    peerPhoto: peerUser.profilePhoto1Key,
                    latestMessage: data.latestMessage,
                    time: data.time.toISOString(),
                    unreadCount: data.unreadCount,
                });
            }
        }

        return chatList;
    }
}
