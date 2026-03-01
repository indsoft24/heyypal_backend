import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/experts"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow"
        >
          <h2 className="font-medium text-slate-800">Expert requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            View and approve or reject expert applications.
          </p>
        </Link>
        <Link
          href="/dashboard/sellers"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-200 hover:shadow"
        >
          <h2 className="font-medium text-slate-800">Sellers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage seller accounts. Create new sellers (Admin only).
          </p>
        </Link>
      </div>
    </div>
  );
}
