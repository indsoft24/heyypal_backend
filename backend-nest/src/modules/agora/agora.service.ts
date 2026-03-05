import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RtcRole, RtcTokenBuilder } from 'agora-access-token';

export type AgoraRole = 'publisher' | 'subscriber';

@Injectable()
export class AgoraService {
  private readonly appId = process.env.AGORA_APP_ID;
  private readonly appCertificate = process.env.AGORA_APP_CERTIFICATE;

  generateRtcToken(params: { channelName: string; userId: number; role: AgoraRole; expireSeconds?: number }) {
    if (!this.appId || !this.appCertificate) {
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

