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

/** Portrait-style video container (9:16 aspect), compact height. */
function PortraitVideo({ src, className = '' }: { src: string; className?: string }) {
  return (
    <div className={`w-[120px] aspect-[9/16] rounded-lg border border-slate-200 overflow-hidden bg-black shrink-0 ${className}`}>
      <video
        src={src}
        controls
        className="w-full h-full object-contain"
        preload="metadata"
      />
    </div>
  );
}

function ExpandedRow({
  ex,
  pendingVideo,
  onApprove,
  onReject,
  actioning,
}: {
  ex: Expert;
  pendingVideo: PendingExpertVideo | null;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  actioning: boolean;
}) {
  const hasPhotos = ex.profile?.photos && ex.profile.photos.length > 0;
  const approvedVideoUrl = ex.profile?.intro_video_compressed_url || ex.profile?.intro_video_url;
  const hasDocs = ex.expert_type === 'professional' && (ex.profile?.degree_certificate_url || ex.profile?.aadhar_url);
  const showActions = ex.expert_status === 'pending' || pendingVideo;

  return (
    <tr>
      <td colSpan={7} className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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

          {/* Media & Documents + Intro Video (same card: photos/docs left, video portrait right) */}
          <div className="md:col-span-1 flex flex-col md:flex-row md:items-start gap-4">
            <div className="min-w-0 flex-1">
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

              {!hasPhotos && !hasDocs && !pendingVideo && !approvedVideoUrl && (
                <p className="text-xs text-slate-400">No media or documents uploaded.</p>
              )}
            </div>

            {/* Intro Video — always show: pending, approved, or empty state */}
            <div className="shrink-0">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {pendingVideo ? 'Intro Video (pending)' : approvedVideoUrl ? 'Intro Video' : 'Intro Video'}
              </p>
              {pendingVideo ? (
                <PortraitVideo src={pendingVideo.videoUrl} />
              ) : approvedVideoUrl ? (
                <PortraitVideo src={approvedVideoUrl} />
              ) : (
                <div className="w-[120px] aspect-[9/16] rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                  <span className="text-[10px] text-slate-400 text-center px-1">No intro video</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Single set of action buttons (expert + pending video handled together) */}
        {showActions && (
          <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              onClick={onReject}
              disabled={actioning}
              className="rounded-lg border border-red-500 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              disabled={actioning}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              Approve
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpertsPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [pendingVideos, setPendingVideos] = useState<PendingExpertVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    if (!getToken()) return;
    setLoading(true);
    setError('');
    try {
      const [expertsRes, videosRes] = await Promise.all([
        adminApi.getExperts(),
        adminApi.getPendingExpertVideos().catch(() => []),
      ]);
      setExperts(expertsRes.experts);
      setPendingVideos(Array.isArray(videosRes) ? videosRes : []);
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

  const pendingByUserId = new Map<number, PendingExpertVideo>();
  for (const v of pendingVideos) {
    const uid = v.userId ?? (v as { user_id?: number }).user_id ?? v.user?.id;
    if (uid != null && !pendingByUserId.has(uid)) pendingByUserId.set(uid, v);
  }

  /** Single approve: if expert has a pending intro video, approve video first then expert. */
  async function handleApprove(ex: Expert): Promise<void> {
    setActioning(ex.id);
    try {
      const pending = pendingByUserId.get(ex.id);
      if (pending) await adminApi.approveExpertVideo(pending.id);
      await adminApi.approveExpert(ex.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioning(null);
    }
  }

  /** Single reject: if expert has a pending intro video, reject video first then expert. */
  async function handleReject(ex: Expert): Promise<void> {
    setActioning(ex.id);
    try {
      const pending = pendingByUserId.get(ex.id);
      if (pending) await adminApi.rejectExpertVideo(pending.id);
      await adminApi.rejectExpert(ex.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioning(null);
    }
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
              {experts.map((ex: Expert) => {
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
                        pendingVideo={pendingByUserId.get(ex.id) ?? null}
                        onApprove={() => handleApprove(ex)}
                        onReject={() => handleReject(ex)}
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

    </div>
  );
}
