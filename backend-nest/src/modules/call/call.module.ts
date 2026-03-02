import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CallLog } from './entities/call-log.entity';
import { CallSession, CallSessionSchema } from './schemas/call-session.schema';
import { CallLogService } from './call-log.service';
import { CallSessionService } from './call-session.service';
import { PresenceService } from './presence.service';
import { RtcService } from './rtc.service';
import { CallGateway } from './call.gateway';
import { CallController } from './call.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallLog]),
    MongooseModule.forFeature([
      { name: CallSession.name, schema: CallSessionSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'change-me',
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRY') || '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CallController],
  providers: [
    CallLogService,
    CallSessionService,
    PresenceService,
    RtcService,
    CallGateway,
  ],
  exports: [CallLogService, CallSessionService, PresenceService],
})
export class CallModule {}
