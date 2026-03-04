'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminApi,
  type Expert,
  type PendingExpertVideo,
  getToken,
  clearToken,
} from '@/lib/api';

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'pending';
  const styles: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[s] ?? styles.pending}`}
    >
      {s}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-1.5 pr-4 text-xs font-medium text-slate-500 whitespace-nowrap w-36">{label}</td>
      <td className="py-1.5 text-xs text-slate-800 break-words">{value ?? '—'}</td>
    </tr>
  );
}

function ExpandedRow({ ex, onApprove, onReject, actioning }: {
  ex: Expert;
  onApprove: () => void;
  onReject: () => void;
  actioning: boolean;
}) {
  const hasPhotos = ex.profile?.photos && ex.profile.photos.length > 0;
  const hasVideo = ex.profile?.intro_video_compressed_url || ex.profile?.intro_video_url;
  const hasDocs = ex.expert_type === 'professional' && (ex.profile?.degree_certificate_url || ex.profile?.aadhar_url);

  return (
    <tr>
      <td colSpan={7} className="bg-slate-50 px-6 py-5 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* User Details */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">User Details</p>
            <table className="w-full">
              <tbody>
                <DetailRow label="Role" value={ex.role} />
                <DetailRow label="Phone" value={ex.phone} />
                <DetailRow label="Gender" value={ex.gender} />
                <DetailRow label="Date of Birth" value={ex.date_of_birth} />
                <DetailRow label="Google ID" value={ex.google_id} />
              </tbody>
            </table>
          </div>

          {/* Expert Profile */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Expert Profile</p>
            <table className="w-full">
              <tbody>
                <DetailRow label="Category" value={ex.profile?.category} />
                <DetailRow
                  label="Languages"
                  value={ex.profile?.languages_spoken?.length ? ex.profile.languages_spoken.join(', ') : null}
                />
                <DetailRow label="Bio" value={ex.profile?.bio} />
              </tbody>
            </table>
          </div>

          {/* Media & Documents */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Media & Documents</p>

            {hasPhotos && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 mb-1.5">Professional Photos</p>
                <div className="flex flex-wrap gap-2">
                  {ex.profile!.photos!.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition"
                    >
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {hasVideo && (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-500 mb-1.5">Intro Video</p>
                <video
                  src={ex.profile!.intro_video_compressed_url || ex.profile!.intro_video_url || ''}
                  controls
                  className="max-w-full rounded-lg border border-slate-200 max-h-40"
                  preload="metadata"
                />
              </div>
            )}

            {hasDocs && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {ex.profile?.degree_certificate_url && (
                    <a
                      href={ex.profile.degree_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      📄 Degree / Certificate
                    </a>
                  )}
                  {ex.profile?.aadhar_url && (
                    <a
                      href={ex.profile.aadhar_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      🪪 Aadhaar
                    </a>
                  )}
                </div>
              </div>
            )}

            {!hasPhotos && !hasVideo && !hasDocs && (
              <p className="text-xs text-slate-400">No media or documents uploaded.</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {ex.expert_status === 'pending' && (
          <div className="mt-5 flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              onClick={onReject}
              disabled={actioning}
              className="rounded-lg border border-red-500 px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={actioning}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              Approve
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Pending Intro Videos section ─────────────────────────────────────────────
function PendingVideosSection() {
  const router = useRouter();
  const [videos, setVideos] = useState<PendingExpertVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
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

  useEffect(() => { if (getToken()) load(); else setLoading(false); }, []);

  async function approve(id: string) {
    setActioning(id);
    try { await adminApi.approveExpertVideo(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to approve'); }
    finally { setActioning(null); }
  }

  async function reject(id: string) {
    setActioning(id);
    try { await adminApi.rejectExpertVideo(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to reject'); }
    finally { setActioning(null); }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Pending Intro Videos</h2>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 ring-1 ring-amber-200">
          {loading ? '…' : videos.length} pending
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading videos…</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
          <p className="text-base font-medium mb-1">No pending intro videos</p>
          <p className="text-sm">New video submissions will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {videos.map((v) => (
            <div
              key={v.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{v.user?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-500 truncate">{v.user?.email}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">Duration: {v.duration}s</span>
                    <StatusBadge status={v.status} />
                  </div>
                </div>
              </div>

              {/* Video */}
              <div className="p-4 flex-1 flex flex-col gap-3">
                <video
                  src={v.videoUrl}
                  controls
                  className="w-full rounded-lg border border-slate-200 max-h-48 object-cover bg-black"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>

                {/* Action buttons */}
                <div className="flex gap-2 justify-end mt-auto">
                  <button
                    onClick={() => reject(v.id)}
                    disabled={actioning !== null}
                    className="rounded-lg border border-red-500 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(v.id)}
                    disabled={actioning !== null}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpertsPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

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
    try { await adminApi.approveExpert(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to approve'); }
    finally { setActioning(null); }
  }

  async function reject(id: number) {
    setActioning(id);
    try { await adminApi.rejectExpert(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to reject'); }
    finally { setActioning(null); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <svg className="animate-spin h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm">Loading experts…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Expert Profile Requests ── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Expert Requests</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          {experts.length} {experts.length === 1 ? 'request' : 'requests'}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {experts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
          <p className="text-lg font-medium mb-1">No expert requests yet</p>
          <p className="text-sm">New submissions will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {experts.map((ex) => {
                const isExpanded = expanded === ex.id;
                return (
                  <Fragment key={ex.id}>
                    <tr
                      onClick={() => setExpanded(isExpanded ? null : ex.id)}
                      className="cursor-pointer group hover:bg-indigo-50/40 transition-colors"
                    >
                      {/* Expand chevron */}
                      <td className="px-3 py-3 text-slate-400 group-hover:text-indigo-500">
                        <svg
                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-slate-800">{ex.name}</span>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{ex.email}</span>
                      </td>

                      {/* Mobile */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{ex.phone ?? '—'}</span>
                      </td>

                      {/* Expert Type */}
                      <td className="px-4 py-3">
                        {ex.expert_type ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 capitalize">
                            {ex.expert_type === 'professional' ? 'Professional' : 'Supportive'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{ex.profile?.category ?? '—'}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={ex.expert_status} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <ExpandedRow
                        key={`${ex.id}-detail`}
                        ex={ex}
                        onApprove={() => approve(ex.id)}
                        onReject={() => reject(ex.id)}
                        actioning={actioning === ex.id}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pending Intro Videos (merged) ── */}
      <PendingVideosSection />
    </div>
  );
}
