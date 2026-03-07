import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CancelCallPushDto {
  @IsNumber()
  receiverUserId: number;

  @IsString()
  @IsNotEmpty()
  callSessionId: string;
}
