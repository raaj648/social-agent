'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Webhook, Search, RefreshCw, Filter,
  ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

export default function OwnerWebhooks() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { router.push('/dashboard'); return; }

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/owner/webhooks?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  const getStatusIcon = (metadata: any) => {
    if (metadata?.error) return <XCircle className="h-4 w-4 text-red-400" />;
    return <CheckCircle className="h-4 w-4 text-emerald-400" />;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      ai_reply: 'text-violet-400',
      webhook_received: 'text-cyan-400',
      message_sent: 'text-blue-400',
      login: 'text-emerald-400',
      page_connect: 'text-amber-400',
      instagram_connect: 'text-pink-400',
      knowledge_update: 'text-purple-400',
    };
    return colors[action] || 'text-white/60';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Webhook Delivery Logs</h2>
          <p className="text-sm text-white/40">Last 7 days of platform activity</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 rounded-xl border border-white/10 p-1 w-fit" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {[
          { value: 'all', label: 'All Events' },
          { value: 'error', label: 'Errors Only' },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => { setStatusFilter(s.value); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === s.value ? 'bg-violet-500/20 text-violet-300' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-white/30">
          <Webhook className="mb-3 h-12 w-12" />
          <p className="text-sm">No webhook activity in the last 7 days</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="divide-y divide-white/5">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-white/5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                    {getStatusIcon(log.metadata)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium capitalize ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.platform && (
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40 uppercase">{log.platform}</span>
                      )}
                      {log.modelUsed && (
                        <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/30">{log.modelUsed.replace(/^openai\//, '').replace(/^anthropic\//, '')}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/40">
                      {log.userName || log.userEmail} · {log.tenantName}
                      {log.tokensUsed > 0 && ` · ${log.tokensUsed} tokens`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-white/40">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</p>
                    {log.ipAddress && <p className="text-[10px] text-white/20">{log.ipAddress}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/50 transition-all hover:bg-white/5 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="px-3 text-sm text-white/40">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/50 transition-all hover:bg-white/5 disabled:opacity-30">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
