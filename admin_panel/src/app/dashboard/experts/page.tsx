'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type Expert, getToken, clearToken } from '@/lib/api';

function ExpertPhotos({ urls }: { urls: string[] | null }) {
  if (!urls?.length) return <p className="text-slate-500 text-sm">No photos</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500"
        >
          <img
            src={url}
            alt={`Expert photo ${i + 1}`}
            className="h-20 w-20 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect fill="%23e2e8f0" width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="10">Error</text></svg>';
            }}
          />
        </a>
      ))}
    </div>
  );
}

function ExpertVideo({
  compressedUrl,
  originalUrl,
}: {
  compressedUrl: string | null;
  originalUrl: string | null;
}) {
  const src = compressedUrl || originalUrl || null;
  if (!src) return <p className="text-slate-500 text-sm">No intro video</p>;
  return (
    <div className="space-y-1">
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-48 w-full rounded-lg border border-slate-200 bg-slate-900"
        onError={(e) => {
          (e.target as HTMLVideoElement).style.display = 'none';
        }}
      />
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-indigo-600 hover:underline"
      >
        Open in new tab
      </a>
    </div>
  );
}

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  if (!url) return <p className="text-slate-500 text-sm">{label}: —</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-indigo-600 hover:underline"
    >
      {label}
    </a>
  );
}

export default function ExpertsPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState<number | null>(null);

  async function load() {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getExperts();
      setExperts(data.experts);
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

  async function approve(id: number) {
    setActioning(id);
    try {
      await adminApi.approveExpert(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioning(null);
    }
  }

  async function reject(id: number) {
    setActioning(id);
    try {
      await adminApi.rejectExpert(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioning(null);
    }
  }

  if (loading) {
    return <p className="text-slate-500">Loading experts…</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Expert requests</h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="space-y-4">
        {experts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No expert requests yet.
          </div>
        ) : (
          experts.map((ex) => (
            <div
              key={ex.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{ex.name}</p>
                    {ex.expert_type && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {ex.expert_type === 'professional' ? 'Professional expert' : 'Supportive expert'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{ex.email}</p>
                  {ex.google_id && (
                    <p className="text-[11px] text-slate-400">Google ID: {ex.google_id}</p>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      ex.expert_status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : ex.expert_status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {ex.expert_status ?? 'pending'}
                  </span>
                  <div className="mt-1 text-xs text-slate-500">
                    Joined {ex.created_at ? new Date(ex.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-4 py-4 md:grid-cols-3">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-slate-700">User details</p>
                  <p className="text-slate-600">
                    <span className="font-medium">Role:</span> {ex.role}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Phone:</span> {ex.phone ?? '—'}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Gender:</span> {ex.gender ?? '—'}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Date of birth:</span>{' '}
                    {ex.date_of_birth ?? '—'}
                  </p>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="font-medium text-slate-700">Expert profile</p>
                  <p className="text-slate-600">
                    <span className="font-medium">Category:</span>{' '}
                    {ex.profile?.category ?? '—'}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Languages:</span>{' '}
                    {ex.profile?.languages_spoken?.length
                      ? ex.profile.languages_spoken.join(', ')
                      : '—'}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Bio:</span>{' '}
                    {ex.profile?.bio ?? '—'}
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <p className="font-medium text-slate-700">Media & documents</p>
                  <div>
                    <p className="font-medium text-slate-600 mb-1">Photos</p>
                    <ExpertPhotos urls={ex.profile?.photos ?? null} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-600 mb-1">Intro video</p>
                    <ExpertVideo
                      compressedUrl={ex.profile?.intro_video_compressed_url ?? null}
                      originalUrl={ex.profile?.intro_video_url ?? null}
                    />
                  </div>
                  {ex.expert_type === 'professional' && (
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-slate-600">Documents</p>
                      <DocumentLink
                        label="Degree/certificate"
                        url={ex.profile?.degree_certificate_url ?? null}
                      />
                      <DocumentLink
                        label="Aadhaar"
                        url={ex.profile?.aadhar_url ?? null}
                      />
                    </div>
                  )}
                </div>
              </div>

              {ex.expert_status === 'pending' && (
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <button
                    onClick={() => reject(ex.id)}
                    disabled={actioning !== null}
                    className="rounded border border-red-600 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(ex.id)}
                    disabled={actioning !== null}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
