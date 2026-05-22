'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeAdmin } from '@/lib/hooks/use-realtime-admin';
import {
  Users, MessageCircle, MessageSquare,
  Bot, DollarSign, BarChart3, Activity,
  RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

interface DashboardStats {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  aiRepliesToday: number;
  tokensToday: number;
  totalTokens: number;
  facebookPages: number;
  instagramAccounts: number;
  whatsappAccounts: number;
}

const kpiCards = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, color: 'from-violet-500 to-purple-600' },
  { key: 'totalConversations', label: 'Conversations', icon: MessageCircle, color: 'from-emerald-500 to-teal-600' },
  { key: 'totalMessages', label: 'Total Messages', icon: MessageSquare, color: 'from-amber-500 to-orange-600' },
  { key: 'facebookPages', label: 'Facebook Pages', icon: Activity, color: 'from-rose-500 to-pink-600' },
  { key: 'instagramAccounts', label: 'Instagram Accounts', icon: Activity, color: 'from-fuchsia-500 to-purple-600' },
  { key: 'whatsappAccounts', label: 'WhatsApp Accounts', icon: Activity, color: 'from-green-500 to-emerald-600' },
  { key: 'aiRepliesToday', label: 'AI Replies Today', icon: Bot, color: 'from-indigo-500 to-violet-600' },
];

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function StatCard({ label, value, icon: Icon, color, prefix, suffix }: {
  label: string; value: string | number; icon: any; color: string;
  prefix?: string; suffix?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5 transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/5"
      style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full opacity-10"
        style={{ background: `linear-gradient(135deg, ${color.replace('from-', '').split(' ')[0]}, ${color.replace('to-', '').split(' ')[1]})` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/50">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const { loading, refreshing, data, error, refreshNow } = useRealtimeAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-32 text-white/40">
        <div className="text-center">
          <p className="text-sm">{error || 'Failed to load dashboard data.'}</p>
          <button onClick={refreshNow} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5">Retry</button>
        </div>
      </div>
    );
  }

  const planDistribution = data.planDistribution || {};
  const modelBreakdown = data.modelBreakdown || {};
  const planData = Object.entries(planDistribution).map(([name, value]) => ({ name, value }));
  const modelData = Object.entries(modelBreakdown).map(([name, value]) => ({ name, value }));
  const regData = (data.dailyRegistrations || []).map((d) => ({ ...d, date: d.date?.slice(5) || d.date }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Overview</h2>
          <p className="text-sm text-white/40">Real-time analytics and metrics</p>
        </div>
        <button onClick={refreshNow} disabled={refreshing} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/5 hover:text-white disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={data.stats[card.key as keyof DashboardStats]}
            icon={card.icon}
            color={card.color}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <h3 className="mb-4 text-sm font-semibold text-white">Daily Registrations (30 days)</h3>
          {regData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={regData}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                />
                <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#regGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">No data yet</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <h3 className="mb-4 text-sm font-semibold text-white">Plan Distribution</h3>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {planData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">No data yet</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            {planData.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs text-white/60 capitalize">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <h3 className="mb-4 text-sm font-semibold text-white">AI Model Usage (30 days)</h3>
          {modelData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={modelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {modelData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">No AI usage data yet</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
          <h3 className="mb-4 text-sm font-semibold text-white">Top Users (30d activity)</h3>
          {data.topTenants.length > 0 ? (
            <div className="space-y-3">
              {data.topTenants.map((t: any, i: number) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-xs font-bold text-violet-400">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{t.full_name || t.email || 'Unknown'}</p>
                      <p className="text-xs text-white/40">{t.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">{t.conversations || 0} convos</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/30 py-16 text-center">No user activity data yet</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}>
        <h3 className="mb-4 text-sm font-semibold text-white">Token Usage Today</h3>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-3xl font-bold text-white">{data.stats.tokensToday.toLocaleString()}</p>
            <p className="text-sm text-white/40">tokens consumed today</p>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div>
            <p className="text-3xl font-bold text-white">{data.stats.totalTokens.toLocaleString()}</p>
            <p className="text-sm text-white/40">total tokens all time</p>
          </div>
          <div className="h-12 w-px bg-white/10" />
          <div>
            <p className="text-3xl font-bold text-emerald-400">{data.stats.aiRepliesToday.toLocaleString()}</p>
            <p className="text-sm text-white/40">AI replies today</p>
          </div>
        </div>
      </div>
    </div>
  );
}
