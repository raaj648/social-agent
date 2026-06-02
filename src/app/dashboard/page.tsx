'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeDashboard } from '@/lib/hooks/use-realtime-dashboard';
import Link from 'next/link';
import {
  MessageSquare, Facebook, Instagram, MessageCircle, Zap, TrendingUp,
  Users, Bot, ArrowRight, CheckCircle2, Clock, Cpu, Copy, Check,
  ChevronDown, ChevronUp, DollarSign, Crown, BarChart3,
} from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/');
        return;
      }
      setUserEmail(user.email ?? null);
    });
  }, [supabase, router]);

  const { loading, profile, pageCount, igCount, waCount, conversationCount, recentConversations } = useRealtimeDashboard();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);

  useEffect(() => {
    fetch('/api/user/analytics?days=30').then(r => r.json()).then(setAnalyticsData).catch(() => {});
  }, []);

  if (loading) return null;

  const planColors: Record<string, string> = {
    free: 'from-gray-400 to-gray-500',
    starter: 'from-blue-500 to-blue-600',
    pro: 'from-purple-500 to-violet-600',
    enterprise: 'from-amber-500 to-orange-600',
  };
  const planVal = profile?.plan as string | undefined;
  const planGradient = planColors[planVal || 'free'];

  const totalPages = (pageCount || 0) + (igCount || 0) + (waCount || 0);
  const creditsRemaining = (profile?.credits_remaining as number) ?? 0;
  const creditsTotal = (profile?.credits_total as number) ?? 100;
  const creditsPct = Math.min((creditsRemaining / Math.max(creditsTotal, 1)) * 100, 100);
  const fullName = profile?.full_name as string | null;
  const businessName = profile?.business_name as string | null;
  const userNumber = profile?.user_number as number | null;

  const stats = [
    { title: 'Connected Accounts', value: totalPages, icon: Facebook, desc: 'Facebook, Instagram, WhatsApp', gradient: 'from-blue-500 to-blue-600' },
    { title: 'WhatsApp Numbers', value: waCount || 0, icon: MessageCircle, desc: 'Business phone numbers', gradient: 'from-green-500 to-emerald-600' },
    { title: 'Active Conversations', value: conversationCount || 0, icon: MessageSquare, desc: 'Open customer threads', gradient: 'from-green-500 to-emerald-600' },
    { title: 'Credits Remaining', value: creditsRemaining, icon: Zap, desc: `of ${creditsTotal} total  ·  1 reply = 1 credit`, gradient: 'from-orange-500 to-amber-600' },
  ];

  const gettingStarted = [
    { done: totalPages > 0, label: 'Connect a Facebook, Instagram, or WhatsApp account', href: '/dashboard/pages', desc: 'Link your social accounts to start' },
    { done: false, label: 'Configure AI Settings', href: '/dashboard/settings', desc: 'Set model, tone, and behavior' },
    { done: false, label: 'Add Knowledge Base entries', href: '/dashboard/knowledge-base', desc: 'Train AI with your business info' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-8 text-white">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 -translate-y-12 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Welcome back, {fullName || userEmail?.split('@')[0] || 'there'}
            </h1>
            <span className={`rounded-full bg-gradient-to-r ${planGradient} px-3 py-1 text-xs font-bold uppercase tracking-wider`}>
              {planVal || 'free'}
            </span>
          </div>
          <p className="text-blue-100">{businessName || fullName || "My Account"} — Here&apos;s your overview today.</p>

          {/* Credits bar */}
          <div className="mt-4 max-w-md">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-blue-100">Credits Remaining</span>
              <span className="text-blue-100 font-medium">{creditsRemaining} / {creditsTotal}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${creditsPct}%` }} />
            </div>
          </div>

          {/* User ID + Credits info */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2">
              <span className="text-xs text-blue-100">Your ID:</span>
              <span className="font-mono text-sm font-bold text-white">{userNumber ?? '—'}</span>
              <CopyButton text={String(userNumber ?? '')} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-blue-100/80">
              <Zap className="h-3.5 w-3.5" />
              <span>1 credit = 1 AI reply</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 card-hover">
              <div className={`absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10`} />
              <div className="flex items-start justify-between">
                <CardTitleSmall>{stat.title}</CardTitleSmall>
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

      {/* Points & Plan */}
      {analyticsData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
              <BarChart3 className="h-5 w-5 text-violet-600" />
              Credits Usage (30 days)
            </h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Credits Balance</span>
              <span className="text-2xl font-bold">{analyticsData.profile?.credits_remaining ?? '—'} / {analyticsData.profile?.credits_total ?? '—'}</span>
              <span className="text-sm text-muted-foreground ml-2">credits</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-6">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all" style={{ width: `${Math.min(((analyticsData.profile?.credits_remaining ?? 0) / Math.max(analyticsData.profile?.credits_total ?? 1, 1)) * 100, 100)}%` }} />
            </div>
            {analyticsData.actionBreakdown && analyticsData.actionBreakdown.length > 0 ? (
              <div className="space-y-2">
                {analyticsData.actionBreakdown.map((a: any) => (
                  <div key={a.type} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5">
                    <span className="text-sm capitalize text-muted-foreground">{a.type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span>{a.count} calls</span>
                      <span className="font-medium text-violet-600">{a.points} cr</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-violet-50 dark:bg-violet-950/30 px-4 py-2.5">
                  <span className="text-sm font-medium">Total Used</span>
                  <span className="text-sm font-bold text-violet-600">
                    {analyticsData.actionBreakdown.reduce((s: number, a: any) => s + a.points, 0)} of {analyticsData.profile?.credits_total ?? 0} cr
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No usage data this period</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                <Crown className="h-5 w-5 text-amber-500" />
                Current Plan
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <span className={`rounded-full bg-gradient-to-r ${planGradient} px-3 py-1 text-xs font-bold uppercase tracking-wider text-white`}>
                  {analyticsData.current_plan?.name || planVal || 'free'}
                </span>
                {analyticsData.current_plan?.price_monthly_cents > 0 && (
                  <span className="text-sm text-muted-foreground">${(analyticsData.current_plan.price_monthly_cents / 100).toFixed(2)}/month</span>
                )}
              </div>
              {analyticsData.subscription ? (
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <p>Status: <span className="capitalize font-medium text-green-600">{analyticsData.subscription.status}</span></p>
                  <p>Credits: {analyticsData.subscription.points_used} used of {analyticsData.subscription.points_allocated} allocated</p>
                  {analyticsData.subscription.end_date && <p>Renewal: {new Date(analyticsData.subscription.end_date).toLocaleDateString()}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No active subscription</p>
              )}
              <Link href="/dashboard/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-muted px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                Manage Plan <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Token transparency */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
              <button onClick={() => setShowTokenDetails(!showTokenDetails)} className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Real AI Token Usage</h3>
                </div>
                {showTokenDetails ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showTokenDetails && (
                <div className="px-6 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Your plan uses a simplified point system for easy tracking. Real AI token costs vary by model and complexity.</p>
                  {analyticsData.actionBreakdown && analyticsData.actionBreakdown.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.actionBreakdown.map((a: any) => (
                        <div key={a.type} className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5 text-sm">
                          <span className="capitalize text-muted-foreground">{a.type.replace(/_/g, ' ')}</span>
                          <span className="font-mono font-medium">{a.calls > 0 ? `${Math.round((analyticsData.usage?.totalTokens || 0) / a.calls * 100)} tokens/call` : '—'}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm">
                        <span className="font-medium">Total cost (30d):</span>
                        <span className="font-bold text-amber-600">${analyticsData.usage?.totalCost?.toFixed(4) || '0.0000'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No token data available yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Getting Started + Recent Conversations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Getting Started */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Getting Started
          </h3>
          <div className="space-y-3">
            {gettingStarted.map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="flex items-center gap-4 rounded-xl p-3 hover:bg-muted/30 transition-colors group"
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.done ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-muted text-muted-foreground'
                }`}>
                  {step.done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-blue-600 transition-colors">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-green-600" />
              Recent Conversations
            </h3>
            <Link href="/dashboard/conversations" className="text-xs text-blue-600 hover:underline font-medium">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(!recentConversations || recentConversations.length === 0) ? (
              <div className="px-6 py-10 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Connect a page and messages will appear here</p>
              </div>
            ) : (
              (recentConversations as Array<Record<string, unknown>>).map((conv) => (
                <Link
                  key={conv.id as string}
                  href={`/dashboard/conversations/${conv.id}`}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    conv.platform === 'instagram' ? 'bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900 dark:to-rose-900' :
                    conv.platform === 'whatsapp' ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900' :
                    'bg-blue-100 dark:bg-blue-900'
                  }`}>
                    {conv.platform === 'instagram'
                      ? <Instagram className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                      : conv.platform === 'whatsapp'
                      ? <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      : <Facebook className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{(conv.sender_name as string) || (conv.sender_id as string)}</p>
                      {(conv.unread_count as number) > 0 && (
                        <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                          {conv.unread_count as number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{conv.platform as string}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats card */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950 border border-blue-100 dark:border-blue-900 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
          <Cpu className="h-5 w-5 text-purple-600" />
          Platform Summary
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalPages}</p>
            <p className="text-xs text-muted-foreground">Connected Accounts</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{pageCount || 0}</p>
            <p className="text-xs text-muted-foreground">Facebook Pages</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-pink-600">{igCount || 0}</p>
            <p className="text-xs text-muted-foreground">Instagram</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{waCount || 0}</p>
            <p className="text-xs text-muted-foreground">WhatsApp</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4 mt-4">
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{conversationCount || 0}</p>
            <p className="text-xs text-muted-foreground">Active Chats</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{creditsRemaining}</p>
            <p className="text-xs text-muted-foreground">Credits Left</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{Math.round(creditsPct)}%</p>
            <p className="text-xs text-muted-foreground">Credits Used</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {totalPages > 0 ? (conversationCount || 0) > 0 ? 'Active' : 'Idle' : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Bot Status</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardTitleSmall({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-muted-foreground">{children}</p>;
}
