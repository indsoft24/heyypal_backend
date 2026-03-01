import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcrypt';
import pool from '../db/config.js';
import type { User, AdminUser } from '../types/index.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID ?? '');

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string | undefined;
  picture?: string | undefined;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) throw new Error('Invalid Google token payload');
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
}

export async function findOrCreateUserByGoogle(googlePayload: GoogleTokenPayload): Promise<User> {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE google_id = $1 LIMIT 1',
    [googlePayload.sub]
  );
  if (rows.length > 0) {
    return rows[0] as User;
  }
  const { rows: inserted } = await pool.query<{ id: number }>(
    `INSERT INTO users (google_id, name, email, profile_completed) VALUES ($1, $2, $3, 0) RETURNING id`,
    [googlePayload.sub, googlePayload.name ?? googlePayload.email, googlePayload.email]
  );
  const id = inserted[0]!.id;
  const { rows: newRows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return newRows[0] as User;
}

export async function completeProfile(
  userId: number,
  data: { name: string; phone: string; role: 'user' | 'expert' }
): Promise<User> {
  const expertStatus = data.role === 'expert' ? 'pending' : null;
  await pool.query(
    `UPDATE users SET name = $1, phone = $2, role = $3, expert_status = $4, profile_completed = 1, updated_at = now() WHERE id = $5`,
    [data.name, data.phone, data.role, expertStatus, userId]
  );
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (rows.length === 0) throw new Error('User not found');
  return rows[0] as User;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const { rows } = await pool.query(
    'SELECT * FROM admin_users WHERE email = $1 LIMIT 1',
    [email]
  );
  if (rows.length === 0) return null;
  return rows[0] as AdminUser;
}

export async function verifyAdminPassword(
  admin: AdminUser,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, admin.password_hash);
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'seller';
}): Promise<AdminUser> {
  const hash = await bcrypt.hash(data.password, 12);
  const { rows } = await pool.query<{ id: number }>(
    'INSERT INTO admin_users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [data.name, data.email, hash, data.role]
  );
  const id = rows[0]!.id;
  const { rows: userRows } = await pool.query('SELECT * FROM admin_users WHERE id = $1 LIMIT 1', [id]);
  if (!userRows[0]) throw new Error('Failed to load created admin user');
  return userRows[0] as AdminUser;
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  if (rows.length === 0) return null;
  return rows[0] as User;
}
