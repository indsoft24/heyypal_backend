import jwt from 'jsonwebtoken';
import type { JWTAppPayload, JWTAdminPayload } from '../types/index.js';

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
const APP_ACCESS_EXPIRY_SEC = 15 * 60;
const APP_REFRESH_EXPIRY_SEC = 7 * 24 * 60 * 60;
const ADMIN_ACCESS_EXPIRY_SEC = 60 * 60;

export function signAppAccess(payload: Omit<JWTAppPayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    { ...payload, type: 'app' as const },
    SECRET,
    { expiresIn: APP_ACCESS_EXPIRY_SEC }
  );
}

export function signAppRefresh(userId: number): string {
  return jwt.sign(
    { sub: String(userId), type: 'app_refresh' },
    SECRET,
    { expiresIn: APP_REFRESH_EXPIRY_SEC }
  );
}

export function signAdminAccess(payload: Omit<JWTAdminPayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    { ...payload, type: 'admin' as const },
    SECRET,
    { expiresIn: ADMIN_ACCESS_EXPIRY_SEC }
  );
}

export function verifyToken(token: string): jwt.JwtPayload & (JWTAppPayload | JWTAdminPayload) {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & (JWTAppPayload | JWTAdminPayload);
  return decoded;
}

export function decodeRefreshToken(token: string): { sub: string; type: string } {
  const decoded = jwt.verify(token, SECRET) as jwt.JwtPayload & { sub: string; type: string };
  if (decoded.type !== 'app_refresh') throw new Error('Invalid refresh token type');
  return decoded;
}
