function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:8080`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
}
const API_BASE = getApiBase();

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setToken(token: string): void {
  localStorage.setItem('admin_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('admin_token');
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...init } = options;
  const url = `${API_BASE}/api${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Cannot reach API at ${url}. ${msg}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message ?? data.error ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new Error(`Unauthorized (${msg})`);
    throw new Error(msg);
  }
  return data as T;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'seller';
}

export interface Expert {
  id: number;
  google_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  expert_status: string | null;
  created_at?: string;
}

export interface Seller {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

export const adminApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; user: AdminUser }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      token: null,
    }),
  getExperts: () => api<{ experts: Expert[] }>('/admin/experts'),
  approveExpert: (id: number) =>
    api<{ message: string }>(`/admin/experts/${id}/approve`, { method: 'POST' }),
  rejectExpert: (id: number) =>
    api<{ message: string }>(`/admin/experts/${id}/reject`, { method: 'POST' }),
  getSellers: () => api<{ sellers: Seller[] }>('/admin/sellers'),
  createSeller: (name: string, email: string, password: string) =>
    api<{ user: Seller }>('/admin/sellers', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
};
