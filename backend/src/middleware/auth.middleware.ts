import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { getUserById } from '../services/auth.service.js';
import pool from '../db/config.js';
import type { JWTAppPayload, JWTAdminPayload } from '../types/index.js';
import type { AdminUser } from '../types/index.js';

export function authenticateApp(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }
  try {
    const payload = verifyToken(token) as JWTAppPayload;
    if (payload.type !== 'app') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token type' });
      return;
    }
    req.jwtPayload = payload;
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function attachAppUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.userId == null) {
    next();
    return;
  }
  try {
    const user = await getUserById(req.userId);
    if (user) req.user = user;
    next();
  } catch {
    next();
  }
}

export function requireProfileComplete(req: Request, res: Response, next: NextFunction): void {
  const payload = req.jwtPayload as JWTAppPayload | undefined;
  if (!payload || payload.type !== 'app') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (payload.profile_completed !== 1) {
    res.status(403).json({
      error: 'Profile incomplete',
      message: 'Please complete your profile first',
      code: 'PROFILE_INCOMPLETE',
    });
    return;
  }
  next();
}

export function isExpertApproved(req: Request, res: Response, next: NextFunction): void {
  const payload = req.jwtPayload as JWTAppPayload | undefined;
  if (!payload || payload.type !== 'app') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (payload.role !== 'expert' || payload.expert_status !== 'approved') {
    res.status(403).json({
      error: 'Expert access required',
      message: 'Expert account must be approved by admin',
      code: 'EXPERT_NOT_APPROVED',
    });
    return;
  }
  next();
}

export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
    return;
  }
  try {
    const payload = verifyToken(token) as JWTAdminPayload;
    if (payload.type !== 'admin') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid token type' });
      return;
    }
    req.jwtPayload = payload;
    req.adminUserId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export async function attachAdminUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.adminUserId == null) {
    next();
    return;
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM admin_users WHERE id = $1 LIMIT 1',
      [req.adminUserId]
    );
    if (rows.length > 0) req.adminUser = rows[0] as AdminUser;
    next();
  } catch {
    next();
  }
}

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const payload = req.jwtPayload as JWTAdminPayload | undefined;
  if (!payload || payload.type !== 'admin') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (payload.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
    return;
  }
  next();
}

export function isSeller(req: Request, res: Response, next: NextFunction): void {
  const payload = req.jwtPayload as JWTAdminPayload | undefined;
  if (!payload || payload.type !== 'admin') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (payload.role !== 'seller' && payload.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden', message: 'Seller or Admin role required' });
    return;
  }
  next();
}
