import { Injectable } from '@nestjs/common';
import { CallSessionService } from './call-session.service';

/** WebRTC signaling: relay offer, answer, and ICE candidates via MongoDB session and Socket events. */
@Injectable()
export class RtcService {
  constructor(private readonly callSessionService: CallSessionService) {}

  async saveOffer(
    callSessionId: string,
    offer: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.callSessionService.setOffer(callSessionId, offer);
    return session != null;
  }

  async saveAnswer(
    callSessionId: string,
    answer: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.callSessionService.setAnswer(callSessionId, answer);
    return session != null;
  }

  async addIceCandidate(
    callSessionId: string,
    fromUserId: number,
    candidate: Record<string, unknown>,
  ): Promise<boolean> {
    const session = await this.callSessionService.addIceCandidate(
      callSessionId,
      fromUserId,
      candidate,
    );
    return session != null;
  }

  async getSession(callSessionId: string) {
    return this.callSessionService.findBySessionId(callSessionId);
  }
}
