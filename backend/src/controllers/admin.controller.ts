import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/config.js';
import { findAdminByEmail, verifyAdminPassword, createAdminUser } from '../services/auth.service.js';
import { signAdminAccess } from '../lib/jwt.js';

export async function adminLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }
    const admin = await findAdminByEmail(email.trim());
    if (!admin) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const valid = await verifyAdminPassword(admin, password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    const accessToken = signAdminAccess({
      sub: String(admin.id),
      type: 'admin',
      role: admin.role,
      email: admin.email,
    });
    res.status(200).json({
      accessToken,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    res.status(500).json({ error: message });
  }
}

function isMissingColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Unknown column 'created_at'") ||
    msg.includes("Unknown column 'updated_at'") ||
    msg.includes('column "created_at" does not exist') ||
    msg.includes('column "updated_at" does not exist') ||
    msg.includes('column \'created_at\' does not exist') ||
    msg.includes('column \'updated_at\' does not exist')
  );
}

export async function listExpertRequests(req: Request, res: Response): Promise<void> {
  try {
    let rows: { id: number; google_id: string; name: string; email: string; phone: string | null; role: string; expert_status: string | null; created_at?: Date }[];
    try {
      const result = await pool.query(
        `SELECT id, google_id, name, email, phone, role, expert_status, created_at 
         FROM users WHERE role = 'expert' ORDER BY created_at DESC`
      );
      rows = result.rows;
    } catch (e) {
      if (isMissingColumnError(e)) {
        const result = await pool.query(
          `SELECT id, google_id, name, email, phone, role, expert_status 
           FROM users WHERE role = 'expert' ORDER BY id DESC`
        );
        rows = result.rows;
      } else {
        throw e;
      }
    }
    res.status(200).json({ experts: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list experts';
    res.status(500).json({ error: message });
  }
}

export async function approveExpert(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid expert id' });
      return;
    }
    let result: { rowCount: number | null };
    try {
      result = await pool.query(
        "UPDATE users SET expert_status = 'approved', updated_at = now() WHERE id = $1 AND role = 'expert'",
        [id]
      );
    } catch (e) {
      if (isMissingColumnError(e)) {
        result = await pool.query(
          "UPDATE users SET expert_status = 'approved' WHERE id = $1 AND role = 'expert'",
          [id]
        );
      } else {
        throw e;
      }
    }
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }
    res.status(200).json({ message: 'Expert approved', id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve';
    res.status(500).json({ error: message });
  }
}

export async function rejectExpert(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Invalid expert id' });
      return;
    }
    let result: { rowCount: number | null };
    try {
      result = await pool.query(
        "UPDATE users SET expert_status = 'rejected', updated_at = now() WHERE id = $1 AND role = 'expert'",
        [id]
      );
    } catch (e) {
      if (isMissingColumnError(e)) {
        result = await pool.query(
          "UPDATE users SET expert_status = 'rejected' WHERE id = $1 AND role = 'expert'",
          [id]
        );
      } else {
        throw e;
      }
    }
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }
    res.status(200).json({ message: 'Expert rejected', id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject';
    res.status(500).json({ error: message });
  }
}

export async function listSellers(req: Request, res: Response): Promise<void> {
  try {
    let rows: { id: number; name: string; email: string; role: string; created_at?: Date }[];
    try {
      const result = await pool.query(
        `SELECT id, name, email, role, created_at FROM admin_users WHERE role = 'seller' ORDER BY created_at DESC`
      );
      rows = result.rows;
    } catch (e) {
      if (isMissingColumnError(e)) {
        const result = await pool.query(
          `SELECT id, name, email, role FROM admin_users WHERE role = 'seller' ORDER BY id DESC`
        );
        rows = result.rows;
      } else {
        throw e;
      }
    }
    res.status(200).json({ sellers: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sellers';
    res.status(500).json({ error: message });
  }
}

export async function createSeller(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: 'name, email and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    const seller = await createAdminUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role: 'seller',
    });
    res.status(201).json({
      message: 'Seller created',
      user: { id: seller.id, name: seller.name, email: seller.email, role: seller.role },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create seller';
    if (message.includes('duplicate') || message.includes('unique')) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    res.status(500).json({ error: message });
  }
}
