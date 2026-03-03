'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/api';

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!getToken()) {
      router.replace('/login');
    }
  }, [mounted, router]);

  function logout() {
    clearToken();
    router.replace('/login');
    router.refresh();
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link href="/dashboard" className="font-semibold text-lg">HeyyPal Admin</Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link
            href="/dashboard"
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === '/dashboard' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/experts"
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === '/dashboard/experts' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
          >
            Expert requests
          </Link>
          <Link
            href="/dashboard/expert-videos"
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === '/dashboard/expert-videos' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
          >
            Expert videos
          </Link>
          <Link
            href="/dashboard/sellers"
            className={`block rounded-lg px-3 py-2 text-sm ${pathname === '/dashboard/sellers' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
          >
            Sellers
          </Link>
        </nav>
        <div className="p-2 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-sm text-left hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
