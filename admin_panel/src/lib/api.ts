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
  expert_type?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  created_at?: string;
  profile?: {
    id: number;
    type: string;
    category: string;
    bio: string;
    languages_spoken: string[];
    photos: string[] | null;
    intro_video_url: string | null;
    intro_video_compressed_url: string | null;
    degree_certificate_url: string | null;
    aadhar_url: string | null;
    created_at?: string;
    updated_at?: string;
  };
}

export interface Seller {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

/** Pending expert intro video (key-based storage). */
export interface PendingExpertVideo {
  id: string;
  userId: number;
  videoKey: string;
  thumbnailKey: string | null;
  duration: number;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  videoUrl: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    expertStatus: string | null;
  };
}

/** Public URL for a stored file key (GET /api/media/:key). */
export function getMediaUrl(fileKey: string): string {
  return `${API_BASE}/api/media/${encodeURIComponent(fileKey)}`;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  photoUrl: string | null;
  shortDescription: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
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
  getPendingExpertVideos: () =>
    api<PendingExpertVideo[]>('/admin/expert/videos/pending'),
  approveExpertVideo: (id: string) =>
    api<PendingExpertVideo>(`/admin/expert/video/approve/${id}`, { method: 'POST' }),
  rejectExpertVideo: (id: string) =>
    api<PendingExpertVideo>(`/admin/expert/video/reject/${id}`, { method: 'POST' }),
  getSellers: () => api<{ sellers: Seller[] }>('/admin/sellers'),
  createSeller: (name: string, email: string, password: string) =>
    api<{ user: Seller }>('/admin/sellers', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  getCategories: (search?: string) =>
    api<Category[]>('/admin/categories' + (search ? `?search=${encodeURIComponent(search)}` : '')),
  getCategory: (id: number) => api<Category>(`/admin/categories/${id}`),
  createCategory: (body: { name: string; slug?: string; photoUrl?: string | null; shortDescription?: string | null; sortOrder?: number }) =>
    api<Category>('/admin/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: number, body: { name?: string; slug?: string; photoUrl?: string | null; shortDescription?: string | null; sortOrder?: number }) =>
    api<Category>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCategory: (id: number) =>
    api<void>(`/admin/categories/${id}`, { method: 'DELETE' }),
  uploadCategoryPhoto: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('photo', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/admin/categories/upload-photo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? data.error ?? `Upload failed`);
    return data;
  },
};
