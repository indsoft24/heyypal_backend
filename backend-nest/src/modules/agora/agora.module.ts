import { Module } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { AgoraController } from './agora.controller';

@Module({
  providers: [AgoraService],
  exports: [AgoraService],
  controllers: [AgoraController],
})
export class AgoraModule {}

