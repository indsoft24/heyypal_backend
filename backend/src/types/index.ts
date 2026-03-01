export type AppUserRole = 'user' | 'expert';
export type ExpertStatus = 'pending' | 'approved' | 'rejected';
export type AdminRole = 'admin' | 'seller';

export interface User {
  id: number;
  google_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AppUserRole;
  expert_status: ExpertStatus | null;
  profile_completed: number;
  created_at: Date;
  updated_at: Date;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  created_at: Date;
  updated_at: Date;
}

export interface JWTAppPayload {
  sub: string;           // user id
  type: 'app';
  role: AppUserRole;
  expert_status: ExpertStatus | null;
  profile_completed: number;
  iat?: number;
  exp?: number;
}

export interface JWTAdminPayload {
  sub: string;           // admin_user id
  type: 'admin';
  role: AdminRole;
  email: string;
  iat?: number;
  exp?: number;
}

export type JWTPayload = JWTAppPayload | JWTAdminPayload;

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: number;
      adminUser?: AdminUser;
      adminUserId?: number;
      jwtPayload?: JWTPayload;
    }
  }
}
