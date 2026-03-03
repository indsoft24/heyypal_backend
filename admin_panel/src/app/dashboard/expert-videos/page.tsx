'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminApi,
  type PendingExpertVideo,
  getToken,
  clearToken,
} from '@/lib/api';

export default function ExpertVideosPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<PendingExpertVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  async function load() {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getPendingExpertVideos();
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setError(msg);
      if (msg.includes('Unauthorized') || msg.includes('401')) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) load();
    else setLoading(false);
  }, []);

  async function approve(id: string) {
    setActioning(id);
    try {
      await adminApi.approveExpertVideo(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioning(null);
    }
  }

  async function reject(id: string) {
    setActioning(id);
    try {
      await adminApi.rejectExpertVideo(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioning(null);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading expert videos…</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        Pending expert intro videos
      </h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-4">
        {videos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No pending expert videos.
          </div>
        ) : (
          videos.map((v) => (
            <div
              key={v.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {v.user?.name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-500">{v.user?.email}</p>
                  <p className="text-xs text-slate-400">
                    User ID: {v.userId} · Duration: {v.duration}s · Status:{' '}
                    {v.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reject(v.id)}
                    disabled={actioning !== null}
                    className="rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(v.id)}
                    disabled={actioning !== null}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-slate-500 mb-2">Intro video</p>
                <video
                  src={v.videoUrl}
                  controls
                  className="max-w-full rounded-lg border border-slate-200 max-h-64"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
