'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Brain, RefreshCw, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend, Cell,
} from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function AIUsage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<any[]>([]);
  const [userUsage, setUserUsage] = useState<any[]>([]);
  const [dailyUsage, setDailyUsage] = useState<any[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) { router.push('/dashboard'); return; }

      const res = await fetch(`/api/admin/owner/usage?days=${days}`);
      const data = await res.json();
      setModels(data.models || []);
      setUserUsage(data.userUsage || []);
      setDailyUsage(data.dailyUsage || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const totalCalls = models.reduce((s: number, m: any) => s + m.totalCalls, 0);
  const totalTokens = models.reduce((s: number, m: any) => s + m.totalTokens, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AI Model Usage</h2>
          <p className="text-sm text-white/40">Breakdown across all tenants</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-white/10 p-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  days === d ? 'bg-violet-500/20 text-violet-300' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total API Calls</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total Tokens</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Models Used</p>
          <p className="mt-1 text-2xl font-bold text-white">{models.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
              <h3 className="mb-4 text-sm font-semibold text-white">Model Distribution (Calls)</h3>
              {models.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={models} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="model" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }} />
                    <Bar dataKey="totalCalls" radius={[0, 6, 6, 0]}>
                      {models.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="py-16 text-center text-sm text-white/30">No data</p>}
            </div>

            <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
              <h3 className="mb-4 text-sm font-semibold text-white">Daily Usage Trend</h3>
              {dailyUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={dailyUsage}>
                    <defs>
                      <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }} />
                    <Area type="monotone" dataKey="totalCalls" stroke="#8b5cf6" strokeWidth={2} fill="url(#callGrad)" name="Calls" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="py-16 text-center text-sm text-white/30">No data</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
            <h3 className="mb-4 text-sm font-semibold text-white">Per-User AI Usage</h3>
            {userUsage.length > 0 ? (
              <div className="space-y-2">
                {userUsage.map((t: any) => (
                  <div key={t.userId}>
                    <button
                      onClick={() => setExpandedUser(expandedUser === t.userId ? null : t.userId)}
                      className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-left transition-all hover:bg-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <Brain className="h-4 w-4 text-violet-400" />
                        <span className="text-sm font-medium text-white">{t.userName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span>{t.totalCalls} calls</span>
                        <span>{t.totalTokens.toLocaleString()} tokens</span>
                        {expandedUser === t.userId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandedUser === t.userId && (
                      <div className="mt-1 space-y-1 px-4">
                        {Object.entries(t.models).map(([model, count]) => (
                          <div key={model} className="flex items-center justify-between rounded-lg bg-white/3 px-4 py-2">
                            <span className="text-xs text-white/60">{model}</span>
                            <span className="text-xs font-medium text-white">{count as number} calls</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-white/30">No usage data</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
