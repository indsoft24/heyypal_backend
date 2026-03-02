import { Injectable } from '@nestjs/common';
import { CallSessionService } from './call-session.service';

/** Tracks whether a user is available and/or in a call. Uses live MongoDB session state. */
@Injectable()
export class PresenceService {
  constructor(private readonly callSessionService: CallSessionService) {}

  /** True if user is not currently in an active call (initiated/ringing/connected). */
  async isUserAvailable(userId: number): Promise<boolean> {
    const count = await this.callSessionService.countActiveSessionsForUser(userId);
    return count === 0;
  }

  /** True if user has at least one active session (ringing or in-call). */
  async isUserInCall(userId: number): Promise<boolean> {
    const count = await this.callSessionService.countActiveSessionsForUser(userId);
    return count > 0;
  }

  /** Get active session for user if any (caller or receiver). */
  async getActiveSession(userId: number) {
    return this.callSessionService.findActiveSessionByUser(userId);
  }
}
