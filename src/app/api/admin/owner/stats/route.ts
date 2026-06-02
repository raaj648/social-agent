import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const [
      { count: totalUsers },
      { count: totalConversations },
      { count: totalMessages },
      usageTodayResult,
      usageTotalResult,
      modelUsageResult,
      dailyStatsResult,
      planDistResult,
      topUsersResult,
      costTodayResult,
      costAllResult,
      pointsTodayResult,
      pointsAllResult,
      subResult,
      revenueResult,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('usage_logs')
        .select('tokens_used, action')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabase.from('usage_logs')
        .select('tokens_used'),
      supabase.from('usage_logs')
        .select('model_used')
        .not('model_used', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      supabase.rpc('get_daily_registrations', { days: 30 }),
      supabase.from('users')
        .select('plan'),
      supabase.from('users')
        .select('id, email, full_name, plan, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('usage_logs')
        .select('total_cost')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabase.from('usage_logs')
        .select('total_cost'),
      supabase.from('usage_logs')
        .select('points_charged')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabase.from('usage_logs')
        .select('points_charged'),
      supabase.from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase.from('user_subscriptions')
        .select('plan_id'),
    ]);

    const planDistribution: Record<string, number> = {};
    const planUsers = planDistResult.data || [];
    for (const u of planUsers as { plan: string }[]) {
      planDistribution[u.plan] = (planDistribution[u.plan] || 0) + 1;
    }

    const usageToday = (usageTodayResult.data || []) as { action: string; tokens_used: number }[];
    const usageTotal = (usageTotalResult.data || []) as { tokens_used: number }[];
    const modelLogs = (modelUsageResult.data || []) as { model_used: string }[];
    const dailyRegistrations = (dailyStatsResult.data || []) as { date: string; count: number }[];
    const topUsers = (topUsersResult.data || []) as any[];

    const aiRepliesToday = usageToday.filter((l) => l.action === 'ai_reply').length;
    const tokensToday = usageToday.reduce((sum, l) => sum + (l.tokens_used || 0), 0);
    const totalTokens = usageTotal.reduce((sum, l) => sum + (l.tokens_used || 0), 0);

    const costToday = (costTodayResult.data || []).reduce((s: number, r: any) => s + (r.total_cost || 0), 0);
    const totalCost = (costAllResult.data || []).reduce((s: number, r: any) => s + (r.total_cost || 0), 0);
    const pointsToday = (pointsTodayResult.data || []).reduce((s: number, r: any) => s + (r.points_charged || 0), 0);
    const totalPointsCharged = (pointsAllResult.data || []).reduce((s: number, r: any) => s + (r.points_charged || 0), 0);

    const activeSubscriptions = subResult.count || 0;

    // Approximate monthly revenue from active subscriptions
    const subPlanIds = (revenueResult.data || []).map((r: any) => r.plan_id).filter(Boolean);
    let monthlyRevenue = 0;
    if (subPlanIds.length > 0) {
      const { data: subPlans } = await supabase
        .from('billing_plans')
        .select('id, price_monthly_cents')
        .in('id', subPlanIds);
      if (subPlans) {
        for (const sp of subPlans) {
          monthlyRevenue += sp.price_monthly_cents || 0;
        }
      }
    }

    const modelBreakdown: Record<string, number> = {};
    for (const m of modelLogs) {
      const model = m.model_used.replace(/^openai\//, '').replace(/^anthropic\//, '').replace(/^google\//, '');
      modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
    }

    const { count: waCount } = await supabase.from('whatsapp_accounts').select('*', { count: 'exact', head: true });
    const { count: igCount } = await supabase.from('instagram_accounts').select('*', { count: 'exact', head: true });
    const { count: fbCount } = await supabase.from('connected_pages').select('*', { count: 'exact', head: true });

    const enrichedTopUsers = await Promise.all(
      (topUsers || []).map(async (u: any) => {
        const { count: convCount } = await supabase
          .from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        const { data: recentUsage } = await supabase
          .from('usage_logs').select('tokens_used')
          .eq('user_id', u.id)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
        const tokens30d = ((recentUsage || []) as { tokens_used: number }[]).reduce((s, u) => s + (u.tokens_used || 0), 0);
        return { ...u, conversations: convCount || 0, tokens30d };
      })
    );

    return NextResponse.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalConversations: totalConversations || 0,
        totalMessages: totalMessages || 0,
        aiRepliesToday,
        tokensToday,
        totalTokens,
        costToday: Math.round(costToday * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        pointsToday,
        totalPointsCharged,
        activeSubscriptions,
        monthlyRevenue,
        facebookPages: fbCount || 0,
        instagramAccounts: igCount || 0,
        whatsappAccounts: waCount || 0,
      },
      dailyRegistrations,
      planDistribution,
      modelBreakdown,
      topTenants: enrichedTopUsers, // top users by activity (30d)
      usageTrend: [],
    });
  } catch (error) {
    console.error('Owner stats error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
