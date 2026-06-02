'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Brain, RefreshCw, BarChart3, DollarSign, Download, ChevronUp, ChevronDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'by-model', label: 'By Model' },
  { id: 'by-provider', label: 'By Provider' },
  { id: 'by-action', label: 'By Action Type' },
  { id: 'by-user', label: 'By User' },
];

type SortConfig = { key: string; direction: 'asc' | 'desc' };

function SortableHeader({ label, sortKey, sort, onSort }: {
  label: string; sortKey: string; sort: SortConfig | null; onSort: (key: string) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className="pb-2 pr-2 font-medium cursor-pointer select-none hover:text-white/80 transition-colors" onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sort!.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}

function useSort<T>(data: T[], config: SortConfig | null): T[] {
  if (!config || !data.length) return data;
  return [...data].sort((a: any, b: any) => {
    const av = a[config.key] ?? 0;
    const bv = b[config.key] ?? 0;
    if (typeof av === 'string' && typeof bv === 'string') {
      return config.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return config.direction === 'asc' ? (av - bv) : (bv - av);
  });
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AIUsage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [models, setModels] = useState<any[]>([]);
  const [userUsage, setUserUsage] = useState<any[]>([]);
  const [dailyUsage, setDailyUsage] = useState<any[]>([]);
  const [actionTypeBreakdown, setActionTypeBreakdown] = useState<any[]>([]);
  const [providerBreakdown, setProviderBreakdown] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [modelSort, setModelSort] = useState<SortConfig | null>(null);
  const [providerSort, setProviderSort] = useState<SortConfig | null>(null);
  const [actionSort, setActionSort] = useState<SortConfig | null>(null);
  const [userSort, setUserSort] = useState<SortConfig | null>(null);

  const fetchData = useCallback(async () => {
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
      setActionTypeBreakdown(data.actionTypeBreakdown || []);
      setProviderBreakdown(data.providerBreakdown || []);
      setTotalCost(data.totalCost || 0);
      setTotalPoints(data.totalPoints || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [days, router, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedModels = useSort(models, modelSort);
  const sortedProviders = useSort(providerBreakdown, providerSort);
  const sortedActions = useSort(actionTypeBreakdown, actionSort);
  const sortedUsers = useSort(userUsage, userSort);

  const totalCalls = models.reduce((s: number, m: any) => s + m.totalCalls, 0);
  const totalTokens = models.reduce((s: number, m: any) => s + m.totalTokens, 0);

  function handleSort(tab: string, key: string) {
    const setters: Record<string, { sort: SortConfig | null; set: any }> = {
      'by-model': { sort: modelSort, set: setModelSort },
      'by-provider': { sort: providerSort, set: setProviderSort },
      'by-action': { sort: actionSort, set: setActionSort },
      'by-user': { sort: userSort, set: setUserSort },
    };
    const s = setters[tab];
    if (!s) return;
    s.set((prev: SortConfig | null) => prev?.key === key && prev.direction === 'asc' ? { key, direction: 'desc' } : { key, direction: 'asc' });
  }

  function exportCSV(tab: string) {
    const date = new Date().toISOString().slice(0, 10);
    switch (tab) {
      case 'by-model':
        downloadCSV(`models-${date}.csv`, ['Model', 'Calls', 'Tokens', 'Cost', 'Credits', 'Users'], sortedModels.map((m: any) => [csvEscape(m.model), String(m.totalCalls), String(m.totalTokens), m.totalCost.toFixed(4), String(m.totalPoints), String(m.userCount)]));
        downloadCSV(`actions-${date}.csv`, ['Action', 'Calls', 'Cost', 'Credits', 'Tokens'], sortedActions.map((a: any) => [a.type, String(a.totalCalls), a.totalCost.toFixed(4), String(a.totalPoints), String(a.totalTokens)]));
        downloadCSV(`users-${date}.csv`, ['User', 'Calls', 'Tokens', 'Cost', 'Credits'], sortedUsers.map((u: any) => [csvEscape(u.userName), String(u.totalCalls), String(u.totalTokens), u.totalCost.toFixed(4), String(u.totalPoints)]));
        break;
    }
  }

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
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${days === d ? 'bg-violet-500/20 text-violet-300' : 'text-white/40 hover:text-white/70'}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total API Calls</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total Tokens</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total Cost</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">${totalCost.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Total Credits</p>
          <p className="mt-1 text-2xl font-bold text-violet-400">{totalPoints.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <p className="text-sm text-white/50">Models Used</p>
          <p className="mt-1 text-2xl font-bold text-white">{models.length}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-violet-500/20 text-violet-300' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
            {tab.label}
          </button>
        ))}
        {activeTab !== 'overview' && (
          <button onClick={() => exportCSV(activeTab)} className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white/80 transition-all">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : (
        <>
          {activeTab === 'overview' && (
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
              <div className="rounded-2xl border border-white/10 p-5 lg:col-span-2" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
                <h3 className="mb-4 text-sm font-semibold text-white">Cost vs Points (Daily)</h3>
                {dailyUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }} />
                      <Bar yAxisId="left" dataKey="totalCost" name="Cost ($)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="totalPoints" name="Credits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="py-16 text-center text-sm text-white/30">No data</p>}
              </div>
            </div>
          )}

          {activeTab === 'by-model' && (
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
              <h3 className="mb-4 text-sm font-semibold text-white">Model Breakdown ({days}d)</h3>
              {sortedModels.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/40 uppercase tracking-wider">
                      <SortableHeader label="Model" sortKey="model" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <SortableHeader label="Calls" sortKey="totalCalls" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <SortableHeader label="Tokens" sortKey="totalTokens" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <SortableHeader label="Cost" sortKey="totalCost" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <SortableHeader label="Credits" sortKey="totalPoints" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <SortableHeader label="Users" sortKey="userCount" sort={modelSort} onSort={(k) => handleSort('by-model', k)} />
                      <th className="pb-2 font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedModels.map((m: any) => (
                      <tr key={m.model} className="text-white/70">
                        <td className="py-1.5 pr-2 font-medium text-white">{m.model}</td>
                        <td className="py-1.5 pr-2">{m.totalCalls}</td>
                        <td className="py-1.5 pr-2">{m.totalTokens.toLocaleString()}</td>
                        <td className="py-1.5 pr-2 text-amber-400">${m.totalCost.toFixed(2)}</td>
                        <td className="py-1.5 pr-2 text-violet-400">{m.totalPoints}</td>
                        <td className="py-1.5 pr-2">{m.userCount}</td>
                        <td className="py-1.5 text-emerald-400">${(m.totalPoints - m.totalCost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="py-16 text-center text-sm text-white/30">No model data</p>}
            </div>
          )}

          {activeTab === 'by-provider' && (
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
              <h3 className="mb-4 text-sm font-semibold text-white">Provider Breakdown ({days}d)</h3>
              {sortedProviders.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-white/40 uppercase tracking-wider">
                      <SortableHeader label="Provider" sortKey="providerName" sort={providerSort} onSort={(k) => handleSort('by-provider', k)} />
                      <SortableHeader label="Models" sortKey="modelsCount" sort={providerSort} onSort={(k) => handleSort('by-provider', k)} />
                      <SortableHeader label="Calls" sortKey="totalCalls" sort={providerSort} onSort={(k) => handleSort('by-provider', k)} />
                      <SortableHeader label="Cost" sortKey="totalCost" sort={providerSort} onSort={(k) => handleSort('by-provider', k)} />
                      <SortableHeader label="Tokens" sortKey="totalTokens" sort={providerSort} onSort={(k) => handleSort('by-provider', k)} />
                      <th className="pb-2 font-medium">Avg Cost/Call</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sortedProviders.map((p: any) => (
                      <tr key={p.providerId} className="text-white/70">
                        <td className="py-1.5 pr-2 font-medium text-white">{p.providerName}</td>
                        <td className="py-1.5 pr-2">{p.modelsCount}</td>
                        <td className="py-1.5 pr-2">{p.totalCalls}</td>
                        <td className="py-1.5 pr-2 text-amber-400">${p.totalCost.toFixed(2)}</td>
                        <td className="py-1.5 pr-2">{p.totalTokens.toLocaleString()}</td>
                        <td className="py-1.5">${(p.totalCost / Math.max(p.totalCalls, 1)).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="py-16 text-center text-sm text-white/30">No provider data</p>}
            </div>
          )}

          {activeTab === 'by-action' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
                <h3 className="mb-4 text-sm font-semibold text-white">Cost Distribution by Action</h3>
                {sortedActions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={sortedActions} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="totalCost" nameKey="type"
                        label={({ type, totalCost }: any) => `${type.replace(/_/g, ' ')}: $${totalCost.toFixed(2)}`}>
                        {sortedActions.map((_: any, idx: number) => (
                          <Cell key={idx} fill={['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][idx % 4]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="py-16 text-center text-sm text-white/30">No action type data</p>}
              </div>
              <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
                <h3 className="mb-4 text-sm font-semibold text-white">Action Type Details ({days}d)</h3>
                {sortedActions.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-white/40 uppercase tracking-wider">
                        <SortableHeader label="Action" sortKey="type" sort={actionSort} onSort={(k) => handleSort('by-action', k)} />
                        <SortableHeader label="Calls" sortKey="totalCalls" sort={actionSort} onSort={(k) => handleSort('by-action', k)} />
                        <SortableHeader label="Cost" sortKey="totalCost" sort={actionSort} onSort={(k) => handleSort('by-action', k)} />
                        <SortableHeader label="Credits" sortKey="totalPoints" sort={actionSort} onSort={(k) => handleSort('by-action', k)} />
                        <th className="pb-2 font-medium">Profit Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sortedActions.map((a: any) => (
                        <tr key={a.type} className="text-white/70">
                          <td className="py-1.5 pr-2 font-medium text-white capitalize">{a.type.replace(/_/g, ' ')}</td>
                          <td className="py-1.5 pr-2">{a.totalCalls}</td>
                          <td className="py-1.5 pr-2 text-amber-400">${a.totalCost.toFixed(2)}</td>
                          <td className="py-1.5 pr-2 text-violet-400">{a.totalPoints}</td>
                          <td className="py-1.5 text-emerald-400">
                            {a.totalCost > 0 ? `${((a.totalPoints - a.totalCost) / a.totalCost * 100).toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="py-16 text-center text-sm text-white/30">No action data</p>}
              </div>
            </div>
          )}

          {activeTab === 'by-user' && (
            <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
              <h3 className="mb-4 text-sm font-semibold text-white">Per-User AI Usage ({days}d)</h3>
              {sortedUsers.length > 0 ? (
                <div className="space-y-2">
                  {sortedUsers.map((t: any) => (
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
                          <span className="text-amber-400/80">${t.totalCost?.toFixed(2)}</span>
                          <span className="text-violet-400/80">{t.totalPoints} cr</span>
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
                <p className="py-16 text-center text-sm text-white/30">No user usage data</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}