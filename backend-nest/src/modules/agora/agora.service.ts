import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcRole, RtcTokenBuilder } from 'agora-access-token';

export type AgoraRole = 'publisher' | 'subscriber';

@Injectable()
export class AgoraService {
  private readonly appId: string;
  private readonly appCertificate: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('AGORA_APP_ID') ?? '';
    this.appCertificate = config.get<string>('AGORA_APP_CERTIFICATE') ?? '';
  }

  generateRtcToken(params: { channelName: string; userId: number; role: AgoraRole; expireSeconds?: number }) {
    if (!this.appId?.trim() || !this.appCertificate?.trim()) {
      throw new InternalServerErrorException('Agora credentials not configured on server');
    }
    const { channelName, userId, role, expireSeconds = 3600 } = params;
    const uid = userId;
    const currentTs = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTs + expireSeconds;
    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      uid,
      rtcRole,
      privilegeExpireTs,
    );

    return {
      token,
      appId: this.appId,
      channelName,
      uid,
      expireAt: privilegeExpireTs,
    };
  }
}

