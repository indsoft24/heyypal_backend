'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type Expert, getToken, clearToken } from '@/lib/api';

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

                <div className="space-y-1 text-sm">
                  <p className="font-medium text-slate-700">Media & documents</p>
                  <p className="text-slate-600">
                    <span className="font-medium">Photos:</span>{' '}
                    {ex.profile?.photos?.length ?? 0} file(s)
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Intro video:</span>{' '}
                    {ex.profile?.intro_video_compressed_url
                      ? 'Compressed video available'
                      : ex.profile?.intro_video_url
                        ? 'Original video only'
                        : '—'}
                  </p>
                  {ex.expert_type === 'professional' && (
                    <>
                      <p className="text-slate-600">
                        <span className="font-medium">Degree/certificate:</span>{' '}
                        {ex.profile?.degree_certificate_url ? 'Uploaded' : 'Missing'}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium">Aadhaar:</span>{' '}
                        {ex.profile?.aadhar_url ? 'Uploaded' : 'Missing'}
                      </p>
                    </>
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
