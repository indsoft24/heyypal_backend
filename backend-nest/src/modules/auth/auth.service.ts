import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserRole, ExpertStatus } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshRepo: Repository<RefreshToken>,
  ) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.googleClient = new OAuth2Client(clientId.split(',')[0]?.trim() || undefined);
  }

  /** Returns allowed Google OAuth client IDs (Android + Web). Token must be issued for one of these. */
  private getGoogleAudiences(): string[] {
    const raw = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!raw?.trim()) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async validateGoogleToken(idToken: string): Promise<{ sub: string; email: string; name?: string }> {
    const audiences = this.getGoogleAudiences();
    if (audiences.length === 0) throw new UnauthorizedException('Google Sign-In not configured (GOOGLE_CLIENT_ID)');

    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: audiences });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload?.email) throw new UnauthorizedException('Invalid Google token');
      return { sub: payload.sub, email: payload.email, name: payload.name };
    } catch (error) {
      throw new UnauthorizedException(`Google login failed: ${error.message}`);
    }
  }

  async loginWithGoogle(idToken: string) {
    const payload = await this.validateGoogleToken(idToken);
    let user = await this.userRepo.findOne({ where: { googleId: payload.sub } });
    if (!user) {
      user = this.userRepo.create({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name ?? payload.email,
      });
      await this.userRepo.save(user);
    }
    return this.issueTokens(user);
  }

  async issueTokens(user: User) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      expertStatus: user.expertStatus,
      profileCompleted: user.profileCompleted,
    });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshRepo.save(
      this.refreshRepo.create({ userId: user.id, tokenHash: hash, expiresAt }),
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        expertStatus: user.expertStatus,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  async refresh(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const rt = await this.refreshRepo.findOne({
      where: { tokenHash: hash },
      relations: ['user'],
    });
    if (!rt || rt.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh token');
    await this.refreshRepo.remove(rt);
    return this.issueTokens(rt.user);
  }
}
