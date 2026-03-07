import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SendCallPushDto {
  @IsNumber()
  receiverUserId: number;

  @IsString()
  @IsNotEmpty()
  callId: string;

  @IsString()
  @IsNotEmpty()
  callerId: string;

  @IsString()
  @IsNotEmpty()
  callerName: string;

  @IsString()
  @IsNotEmpty()
  channelName: string;

  @IsOptional()
  @IsString()
  agoraToken?: string;

  @IsOptional()
  @IsNumber()
  uid?: number;
}
