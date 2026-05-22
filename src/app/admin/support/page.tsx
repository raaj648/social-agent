'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy, Search, RefreshCw, UserCheck,
  Mail, MessageSquare, ExternalLink, Copy,
  CheckCircle, XCircle, Users, Gauge,
} from 'lucide-react';
import { format } from 'date-fns';

export default function OwnerSupport() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [impersonateUserId, setImpersonateUserId] = useState('');
  const [impersonateResult, setImpersonateResult] = useState<any>(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(100);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<string | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { router.push('/dashboard'); return; }

      const { data: users } = await supabase.from('users').select('id, email, full_name, user_number, plan, created_at').order('created_at', { ascending: false }).limit(10);
      setRecentUsers(users || []);
      setLoading(false);
    };
    init();
  }, []);

  const handleImpersonate = async () => {
    if (!impersonateUserId.trim()) return;
    setImpersonateLoading(true);
    setImpersonateResult(null);
    try {
      const res = await fetch('/api/admin/owner/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: impersonateUserId }),
      });
      const data = await res.json();
      setImpersonateResult(data);
      if (data.user) {
        setCreditsRemaining(data.user.credits_remaining ?? 0);
        setCreditsTotal(data.user.credits_total ?? 100);
        setQuotaStatus(null);
      }
    } catch (e) {
      setImpersonateResult({ error: String(e) });
    } finally {
      setImpersonateLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function handleSaveQuota() {
    if (!impersonateResult?.user?.id) return;
    setQuotaSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: impersonateResult.user.id, credits_remaining: creditsRemaining, credits_total: creditsTotal }),
      });
      const data = await res.json();
      if (data.success) {
        setQuotaStatus('Quota updated successfully');
      } else {
        setQuotaStatus('Error: ' + (data.error || 'Failed'));
      }
    } catch (e: any) {
      setQuotaStatus('Error: ' + e.message);
    } finally {
      setQuotaSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Support Tools</h2>
        <p className="text-sm text-white/40">User impersonation and assistance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <UserCheck className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">User Lookup</h3>
              <p className="text-xs text-white/40">Find user by ID</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={impersonateUserId}
              onChange={(e) => setImpersonateUserId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImpersonate()}
              placeholder="Enter user UUID..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
            <button
              onClick={handleImpersonate}
              disabled={impersonateLoading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> Lookup
            </button>
          </div>

          {impersonateResult && (
            <div className="mt-4 rounded-xl bg-white/5 p-4">
              {impersonateResult.error ? (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{impersonateResult.error}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white">
                        {impersonateResult.user?.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{impersonateResult.user?.full_name || 'No name'}</p>
                        <p className="text-xs text-white/50">{impersonateResult.user?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(impersonateResult.user?.id || '')}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10"
                    >
                      {copied ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>
                  {impersonateResult.tenant && (
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <Users className="h-4 w-4 text-violet-400" />
                      <span className="text-sm text-white/70">{impersonateResult.tenant.name}</span>
                      <span className="text-xs text-white/30">({impersonateResult.tenant.slug})</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(`/admin/tenants`, '_blank')}
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10"
                    >
                      <ExternalLink className="h-3 w-3" /> View Tenant
                    </button>
                    <button
                      onClick={() => copyToClipboard(impersonateResult.user?.email || '')}
                      className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10"
                    >
                      <Mail className="h-3 w-3" /> Copy Email
                    </button>
                  </div>

                  {/* Credit Management */}
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">Credit Management</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="rounded-lg bg-white/5 px-3 py-2">
                        <p className="text-[10px] text-white/40 uppercase">Credits Remaining</p>
                        <p className="text-lg font-bold text-white">{impersonateResult.user?.credits_remaining ?? '—'}</p>
                      </div>
                      <div className="rounded-lg bg-white/5 px-3 py-2">
                        <p className="text-[10px] text-white/40 uppercase">Total Credits</p>
                        <p className="text-lg font-bold text-white">{impersonateResult.user?.credits_total ?? '—'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-white/50 w-28">Set Remaining</label>
                        <input
                          type="number"
                          value={creditsRemaining}
                          onChange={(e) => setCreditsRemaining(Number(e.target.value))}
                          min={0}
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-white/50 w-28">Set Total</label>
                        <input
                          type="number"
                          value={creditsTotal}
                          onChange={(e) => setCreditsTotal(Number(e.target.value))}
                          min={0}
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500/50"
                        />
                        <button
                          onClick={() => { setCreditsRemaining(0); setCreditsTotal(0); }}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/10"
                          title="Reset credits"
                        >
                          Reset
                        </button>
                      </div>
                      <button
                        onClick={handleSaveQuota}
                        disabled={quotaSaving}
                        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
                      >
                        {quotaSaving ? 'Saving...' : 'Save Credits'}
                      </button>
                      {quotaStatus && (
                        <p className={`text-xs ${quotaStatus.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{quotaStatus}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <MessageSquare className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Quick Actions</h3>
              <p className="text-xs text-white/40">Common support tasks</p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => copyToClipboard(window.location.origin + '/login')}
              className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-all hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4 text-violet-400" />
              Copy Login URL
            </button>
            <button className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-all hover:bg-white/10">
              <Mail className="h-4 w-4 text-violet-400" />
              Contact Support (support@)
            </button>
            <button className="flex w-full items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-all hover:bg-white/10">
              <Users className="h-4 w-4 text-violet-400" />
              View All Users
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <h3 className="mb-4 text-sm font-semibold text-white">Recent Registrations</h3>
        {recentUsers.length > 0 ? (
          <div className="space-y-2">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition-all hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-xs font-bold text-violet-400">
                    {u.full_name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.full_name || 'No name'}</p>
                    <p className="text-xs text-white/40">{u.email}</p>
                    <p className="text-[10px] text-white/20 font-mono">ID: {u.user_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/30">{u.plan}</span>
                  <span className="text-xs text-white/30">{format(new Date(u.created_at), 'MMM d')}</span>
                  <button
                    onClick={() => { setImpersonateUserId(u.id); handleImpersonate(); }}
                    className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/40 hover:bg-violet-500/20 hover:text-violet-400"
                  >
                    Lookup
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="py-8 text-center text-sm text-white/30">No users yet</p>}
      </div>
    </div>
  );
}
