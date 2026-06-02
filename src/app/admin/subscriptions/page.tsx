'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  RefreshCw, CreditCard, Search, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, AlertTriangle,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  expired: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  past_due: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const STATUS_ICONS: Record<string, any> = {
  active: CheckCircle,
  cancelled: XCircle,
  expired: Clock,
  past_due: AlertTriangle,
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  useEffect(() => { checkAuthAndLoad(); }, [page, search, statusFilter]);

  async function checkAuthAndLoad() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) { router.push('/dashboard'); return; }

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Subscriptions</h2>
          <p className="text-sm text-white/40">{total} total subscription{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by user..." className="w-56 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="past_due">Past Due</option>
          </select>
          <button onClick={checkAuthAndLoad} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center text-sm text-white/30" style={{ background: 'rgba(255,255,255,0.03)' }}>
          No subscriptions found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">End Date</th>
                <th className="px-4 py-3 font-medium">Auto Renew</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {subscriptions.map((sub: any) => {
                const StatusIcon = STATUS_ICONS[sub.status] || CheckCircle;
                return (
                  <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{sub.users?.full_name || sub.users?.email || 'Unknown'}</p>
                      {sub.users?.email && <p className="text-xs text-white/40">{sub.users.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{sub.billing_plans?.name || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] || 'bg-white/5 text-white/50'}`}>
                        <StatusIcon className="h-3 w-3" /> {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">
                      {sub.points_used?.toLocaleString() || 0} / {sub.points_allocated?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">{new Date(sub.start_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{sub.end_date ? new Date(sub.end_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={sub.auto_renew ? 'text-emerald-400' : 'text-white/30'}>{sub.auto_renew ? 'Yes' : 'No'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-xl border border-white/10 p-2 text-white/40 hover:bg-white/5 hover:text-white disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-white/40">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-xl border border-white/10 p-2 text-white/40 hover:bg-white/5 hover:text-white disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
