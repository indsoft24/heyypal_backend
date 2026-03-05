import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'change-me',
    });
  }

  validate(payload: { sub: string | number; email?: string; role?: string }) {
    if (payload.sub === undefined || payload.sub === null) throw new UnauthorizedException();
    const userId = typeof payload.sub === 'number' ? String(payload.sub) : payload.sub;
    return { userId, email: payload.email, role: payload.role };
  }
}
