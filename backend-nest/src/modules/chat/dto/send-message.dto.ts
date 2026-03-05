import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class SendMessageDto {
    @IsNotEmpty()
    @IsNumber()
    receiverId: number;

    @IsNotEmpty()
    @IsString()
    content: string;
}
