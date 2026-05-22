'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Activity, Cpu, TrendingUp, Clock, Zap, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { usePageTitle } from '@/lib/use-page-title';
import { formatDate } from '@/lib/utils';

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export default function AnalyticsPage() {
  usePageTitle('Analytics');
  const [days, setDays] = useState(7);
  const [statsData, setStatsData] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function getUserAndLoad(daysOverride?: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }
    await loadData(user.id, daysOverride);
  }

  useEffect(() => {
    getUserAndLoad(days);
  }, [days]);

  async function loadData(tId: string, daysOverride?: number) {
    if (!tId) return;
    setLoading(true);
    setError(null);

    try {
      const effectiveDays = daysOverride ?? days;
      const rangeStart = new Date();
      rangeStart.setDate(rangeStart.getDate() - effectiveDays);

      const [statsRes, logsRes, aiDataRes, platformsRes] = await Promise.all([
        supabase.rpc('get_dashboard_stats', { p_user_id: tId }),
        supabase.from('usage_logs').select('*').eq('user_id', tId).order('created_at', { ascending: false }).limit(50),
        supabase.from('usage_logs').select('created_at').eq('user_id', tId).eq('action', 'ai_reply').gte('created_at', rangeStart.toISOString()).order('created_at', { ascending: true }),
        supabase.from('usage_logs').select('platform').eq('user_id', tId).gte('created_at', rangeStart.toISOString()),
      ]);

      if (statsRes.error) throw new Error(`Stats error: ${statsRes.error.message}`);
      if (logsRes.error) throw new Error(`Logs error: ${logsRes.error.message}`);
      if (aiDataRes.error) throw new Error(`AI data error: ${aiDataRes.error.message}`);
      if (platformsRes.error) throw new Error(`Platforms error: ${platformsRes.error.message}`);

      const stats = statsRes.data?.[0] || {};
      setStatsData(stats);
      setRecentLogs(logsRes.data || []);
      setAiLogs(aiDataRes.data || []);
      setPlatformBreakdown(platformsRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  const totalConversations = statsData?.total_conversations || 0;
  const totalMessages = statsData?.total_messages || 0;
  const aiRepliesToday = statsData?.ai_replies_today || 0;
  const creditsRemaining = statsData?.credits_remaining ?? 0;
  const creditsTotal = statsData?.credits_total ?? 100;
  const totalPages = statsData?.total_pages || 0;
  const totalInstagram = statsData?.total_instagram || 0;
  const totalWhatsapp = statsData?.total_whatsapp || 0;

  const stats = [
    { title: 'Active Conversations', value: totalConversations, icon: MessageSquare, desc: 'Open threads', gradient: 'from-blue-500 to-blue-600' },
    { title: 'Total Messages', value: totalMessages, icon: Activity, desc: 'All time across all conversations', gradient: 'from-green-500 to-emerald-600' },
    { title: 'AI Replies Today', value: aiRepliesToday, icon: Cpu, desc: `Of ${creditsTotal} total credits`, gradient: 'from-purple-500 to-violet-600' },
    { title: 'Automation Rate', value: totalMessages ? `${Math.round((aiRepliesToday / Math.max(totalMessages, 1)) * 100)}%` : '0%', icon: TrendingUp, desc: 'Messages handled by AI', gradient: 'from-orange-500 to-amber-600' },
  ];

  const dailyMap: Record<string, { ai: number; total: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { ai: 0, total: 0 };
  }
  if (aiLogs) {
    for (const log of aiLogs) {
      const key = new Date(log.created_at).toISOString().slice(0, 10);
      if (dailyMap[key]) dailyMap[key].ai++;
    }
  }
  if (recentLogs) {
    for (const log of recentLogs) {
      const key = new Date(log.created_at).toISOString().slice(0, 10);
      if (dailyMap[key] && (log.action === 'ai_reply' || log.action === 'webhook_received')) {
        dailyMap[key].total++;
      }
    }
  }

  const dailyData = Object.entries(dailyMap).map(([date, counts]) => ({
    date,
    label: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    ...counts,
  }));
  const maxDaily = Math.max(...dailyData.map(d => Math.max(d.ai, d.total)), 1);

  const platformCounts: Record<string, number> = { messenger: 0, instagram: 0, whatsapp: 0 };
  if (platformBreakdown) {
    for (const log of platformBreakdown) {
      if (log.platform) platformCounts[log.platform] = (platformCounts[log.platform] || 0) + 1;
    }
  }
  const platformTotal = Object.values(platformCounts).reduce((a, b) => a + b, 0) || 1;

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 px-6 py-4 text-sm text-red-600 dark:text-red-400 max-w-md text-center">
          {error}
        </div>
          <button onClick={() => getUserAndLoad()} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track performance, usage, and automation metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-input bg-background p-1">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  days === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={() => getUserAndLoad(days)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 card-hover">
              <div className={`absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10`} />
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-6">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Daily Activity ({days} days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Bar dataKey="total" name="Total Activity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ai" name="AI Replies" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-6">
            <Activity className="h-5 w-5 text-green-600" />
            Platform Breakdown
          </h3>
          <div className="space-y-5">
            {[
              { platform: 'messenger', label: 'Messenger', count: platformCounts.messenger || 0, color: 'from-blue-500 to-blue-600' },
              { platform: 'instagram', label: 'Instagram', count: platformCounts.instagram || 0, color: 'from-pink-500 to-rose-600' },
              { platform: 'whatsapp', label: 'WhatsApp', count: platformCounts.whatsapp || 0, color: 'from-green-500 to-emerald-600' },
            ].map((p) => {
              const pct = Math.round((p.count / platformTotal) * 100);
              return (
                <div key={p.platform}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground">{p.count} ({pct}%)</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${p.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Connected Pages</p>
              <p className="text-2xl font-bold text-blue-600">{totalPages}</p>
            </div>
            <div className="rounded-xl bg-pink-50 dark:bg-pink-950 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Instagram</p>
              <p className="text-2xl font-bold text-pink-600">{totalInstagram}</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-950 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
              <p className="text-2xl font-bold text-green-600">{totalWhatsapp}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950 border border-blue-100 dark:border-blue-900 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Zap className="h-5 w-5 text-amber-500" />
          Usage Summary
        </h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalPages + totalInstagram + totalWhatsapp}</p>
            <p className="text-xs text-muted-foreground">Connected Accounts</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{aiRepliesToday}</p>
            <p className="text-xs text-muted-foreground">AI Replies Today</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{creditsRemaining}/{creditsTotal}</p>
            <p className="text-xs text-muted-foreground">Credits Left</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{totalMessages}</p>
            <p className="text-xs text-muted-foreground">Total Messages</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Activity Log
          </h3>
          <span className="text-xs text-muted-foreground">{recentLogs?.length || 0} events</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(!recentLogs || recentLogs.length === 0) ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Activity className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">No activity yet</p>
                <p className="text-sm text-muted-foreground">Connect a page and start receiving messages to see analytics here.</p>
              </div>
            </div>
          ) : (
            recentLogs.map((log, i) => (
              <div key={log.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors animate-fade-in-up" style={{ animationDelay: `${i * 20}ms` }}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  log.action === 'ai_reply' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' :
                  log.action === 'webhook_received' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' :
                  log.action === 'page_connect' || log.action === 'instagram_connect' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' :
                  log.action === 'knowledge_update' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300' :
                  log.action === 'login' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {log.action === 'ai_reply' ? <Cpu className="h-4 w-4" /> :
                   log.action === 'webhook_received' ? <Activity className="h-4 w-4" /> :
                   log.action === 'page_connect' || log.action === 'instagram_connect' ? <TrendingUp className="h-4 w-4" /> :
                   log.action === 'knowledge_update' ? <BarChart3 className="h-4 w-4" /> :
                   log.action === 'login' ? <Zap className="h-4 w-4" /> :
                   <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium capitalize truncate">{log.action.replace(/_/g, ' ')}</p>
                    {log.platform && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{log.platform}</span>
                    )}
                  </div>
                  {log.model_used && <p className="text-xs text-muted-foreground truncate">{log.model_used}</p>}
                </div>
                <div className="text-right shrink-0">
                  {log.tokens_used > 0 && <p className="text-xs font-medium text-muted-foreground">{log.tokens_used} tokens</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
