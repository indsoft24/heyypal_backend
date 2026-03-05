import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (info?.name === 'TokenExpiredError' || err?.name === 'TokenExpiredError') {
      throw new UnauthorizedException({
        message: 'Token expired',
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
      });
    }
    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
