import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/** Extract JWT from Authorization: Bearer <token> or from raw Authorization: <token> (for clients that omit "Bearer "). */
function jwtFromRequest(req: { headers?: { authorization?: string } }) {
  const auth = req?.headers?.authorization;
  if (!auth) return null;
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return auth;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromRequest,
      ]),
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
