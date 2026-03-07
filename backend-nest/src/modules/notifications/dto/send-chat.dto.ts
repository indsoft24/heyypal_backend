import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendChatPushDto {
  @IsNumber()
  receiverUserId: number;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  @IsNotEmpty()
  senderId: string;

  @IsString()
  @IsNotEmpty()
  senderName: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  messageId?: string;
}
