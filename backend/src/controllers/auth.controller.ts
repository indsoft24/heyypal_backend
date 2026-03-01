import type { Request, Response } from 'express';
import { verifyGoogleIdToken, findOrCreateUserByGoogle, completeProfile, getUserById } from '../services/auth.service.js';
import { signAppAccess, signAppRefresh, decodeRefreshToken } from '../lib/jwt.js';
import pool from '../db/config.js';
import crypto from 'crypto';
import type { JWTAppPayload } from '../types/index.js';

export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }
    const payload = await verifyGoogleIdToken(idToken);
    const user = await findOrCreateUserByGoogle(payload);
    const jwtPayload: JWTAppPayload = {
      sub: String(user.id),
      type: 'app',
      role: user.role as 'user' | 'expert',
      expert_status: user.expert_status,
      profile_completed: user.profile_completed,
    };
    const accessToken = signAppAccess(jwtPayload);
    const refreshToken = signAppRefresh(user.id);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, refreshExpiry]
    );
    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        expert_status: user.expert_status,
        profile_completed: user.profile_completed === 1,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google login failed';
    res.status(401).json({ error: 'Authentication failed', message });
  }
}

export async function completeProfileRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (userId == null) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { name, phone, role } = req.body as { name?: string; phone?: string; role?: string };
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      res.status(400).json({ error: 'phone is required' });
      return;
    }
    if (!role || (role !== 'user' && role !== 'expert')) {
      res.status(400).json({ error: 'role must be "user" or "expert"' });
      return;
    }
    const user = await completeProfile(userId, {
      name: name.trim(),
      phone: phone.trim(),
      role: role as 'user' | 'expert',
    });
    const jwtPayload: JWTAppPayload = {
      sub: String(user.id),
      type: 'app',
      role: user.role as 'user' | 'expert',
      expert_status: user.expert_status,
      profile_completed: 1,
    };
    const accessToken = signAppAccess(jwtPayload);
    res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        expert_status: user.expert_status,
        profile_completed: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Profile completion failed';
    res.status(400).json({ error: message });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }
    const decoded = decodeRefreshToken(token);
    const userId = Number(decoded.sub);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(
      'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
      [tokenHash]
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    const row = rows[0];
    if (!row || new Date(row.expires_at as Date) < new Date()) {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }
    const user = await getUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const jwtPayload: JWTAppPayload = {
      sub: String(user.id),
      type: 'app',
      role: user.role as 'user' | 'expert',
      expert_status: user.expert_status,
      profile_completed: user.profile_completed,
    };
    const accessToken = signAppAccess(jwtPayload);
    res.status(200).json({ accessToken, expiresIn: 900 });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.status(200).json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    expert_status: user.expert_status,
    profile_completed: user.profile_completed === 1,
  });
}
