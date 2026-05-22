'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ScrollText, Search, RefreshCw,
  ChevronLeft, ChevronRight, Filter,
  MessageCircle, MessageSquare, Smartphone, Globe,
  Cpu, Clock, Shield, Activity as ActivityIcon,
  Bot, Key, LogIn
} from 'lucide-react';
import { format } from 'date-fns';

const ACTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'ai_reply', label: 'AI Reply' },
  { value: 'webhook_received', label: 'Webhook' },
  { value: 'message_sent', label: 'Message' },
  { value: 'login', label: 'Login' },
  { value: 'page_connect', label: 'Page Connect' },
  { value: 'instagram_connect', label: 'Instagram Connect' },
  { value: 'whatsapp_connect', label: 'WhatsApp Connect' },
  { value: 'knowledge_update', label: 'Knowledge' },
];

const platformIcons: Record<string, any> = {
  messenger: MessageCircle,
  instagram: ActivityIcon,
  whatsapp: Smartphone,
};

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    ai_reply: 'bg-violet-500/20 text-violet-300',
    webhook_received: 'bg-blue-500/20 text-blue-300',
    message_sent: 'bg-emerald-500/20 text-emerald-300',
    login: 'bg-gray-500/20 text-gray-300',
    page_connect: 'bg-cyan-500/20 text-cyan-300',
    instagram_connect: 'bg-pink-500/20 text-pink-300',
    whatsapp_connect: 'bg-green-500/20 text-green-300',
    knowledge_update: 'bg-amber-500/20 text-amber-300',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[action] || 'bg-white/10 text-white/60'}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (!platform) return null;
  const Icon = platformIcons[platform];
  if (!Icon) return null;
  return <Icon className="h-3.5 w-3.5 text-white/40" />;
}

export default function AdminAudit() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const limit = 25;

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
      if (search) params.set('search', search);
      if (actionFilter !== 'all') params.set('action', actionFilter);

      const res = await fetch(`/api/admin/owner/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, actionFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== undefined) { setPage(1); fetchLogs(); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Audit Trail</h2>
          <p className="text-sm text-white/40">{total} total events</p>
        </div>
        <button onClick={fetchLogs} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text" placeholder="Search by email or name..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-white/30" />
          {ACTIONS.map(a => (
            <button key={a.value} onClick={() => { setActionFilter(a.value); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                actionFilter === a.value
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-white/40 border border-white/10 hover:bg-white/5'
              }`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-5 w-5 animate-spin text-violet-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <ScrollText className="h-12 w-12 text-white/20" />
            <div>
              <p className="text-sm font-medium text-white/40">No events found</p>
              <p className="text-xs text-white/30 mt-1">Activity will appear here as users interact with the platform.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                  <PlatformIcon platform={log.platform} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActionBadge action={log.action} />
                    {log.modelUsed && (
                      <span className="text-xs text-violet-400/60 flex items-center gap-1">
                        <Bot className="h-3 w-3" /> {log.modelUsed}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {log.userName || log.userEmail || 'System'}
                    {log.tokensUsed > 0 && ` · ${log.tokensUsed} tokens`}
                    {log.ipAddress && ` · ${log.ipAddress}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-white/40">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <span className="text-xs text-white/40">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5 disabled:opacity-30">
                <ChevronLeft className="h-3 w-3" /> Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5 disabled:opacity-30">
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
