import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createAdminClient();
    const userId = user.id;

    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
    const rangeStart = new Date(Date.now() - days * 86400000).toISOString();

    const [
      profileRes,
      usageRes,
      dailyRes,
      actionTypeRes,
      subRes,
      pointCostTextCfg,
      pointCostImageCfg,
      pointCostVoiceCfg,
    ] = await Promise.all([
      supabase.from('users').select('id, full_name, email, plan, credits_remaining, credits_total').eq('id', userId).single(),
      supabase.from('usage_logs')
        .select('total_cost, points_charged, tokens_used, input_tokens, output_tokens, action_type, model_used, platform')
        .eq('user_id', userId)
        .gte('created_at', rangeStart),
      supabase.from('usage_logs')
        .select('created_at, tokens_used, total_cost, points_charged')
        .eq('user_id', userId)
        .gte('created_at', rangeStart)
        .order('created_at', { ascending: true }),
      supabase.from('usage_logs')
        .select('action_type, points_charged, total_cost')
        .eq('user_id', userId)
        .not('action_type', 'is', null)
        .gte('created_at', rangeStart),
      supabase.from('user_subscriptions')
        .select('*, billing_plans(name, price_monthly_cents, daily_quota)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_text_reply').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_image_read').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_voice_read').maybeSingle(),
    ]);

    const profile = profileRes.data;
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const usageLogs = usageRes.data || [];
    const dailyLogs = dailyRes.data || [];
    const actionLogs = actionTypeRes.data || [];

    const totalCost = usageLogs.reduce((s: number, r: any) => s + (r.total_cost || 0), 0);
    const totalPoints = usageLogs.reduce((s: number, r: any) => s + (r.points_charged || 0), 0);
    const totalTokens = usageLogs.reduce((s: number, r: any) => s + (r.tokens_used || 0), 0);

    const dailyMap: Record<string, { cost: number; points: number; tokens: number }> = {};
    for (const log of dailyLogs) {
      const day = (log.created_at as string).split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { cost: 0, points: 0, tokens: 0 };
      dailyMap[day].cost += log.total_cost || 0;
      dailyMap[day].points += log.points_charged || 0;
      dailyMap[day].tokens += log.tokens_used || 0;
    }

    const actionBreakdown: Record<string, { points: number; cost: number; count: number }> = {};
    for (const log of actionLogs) {
      const type = log.action_type || 'unknown';
      if (!actionBreakdown[type]) actionBreakdown[type] = { points: 0, cost: 0, count: 0 };
      actionBreakdown[type].points += log.points_charged || 0;
      actionBreakdown[type].cost += log.total_cost || 0;
      actionBreakdown[type].count += 1;
    }

    const platformBreakdownMap: Record<string, { points: number; calls: number }> = {};
    for (const log of usageLogs) {
      const plat = (log as any).platform || 'unknown';
      if (!platformBreakdownMap[plat]) platformBreakdownMap[plat] = { points: 0, calls: 0 };
      platformBreakdownMap[plat].points += log.points_charged || 0;
      platformBreakdownMap[plat].calls += 1;
    }

    const currentPlan = subRes.data?.billing_plans ? {
      name: subRes.data.billing_plans.name,
      price_monthly_cents: subRes.data.billing_plans.price_monthly_cents || 0,
      points_per_month: subRes.data.billing_plans.daily_quota || 0,
    } : {
      name: profile.plan,
      price_monthly_cents: 0,
      points_per_month: 0,
    };

    const pointCosts = {
      text_reply: Number(pointCostTextCfg?.data?.value) || 1,
      image_read: Number(pointCostImageCfg?.data?.value) || 3,
      voice_read: Number(pointCostVoiceCfg?.data?.value) || 2,
    };

    return NextResponse.json({
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        plan: profile.plan,
        credits_remaining: profile.credits_remaining,
        credits_total: profile.credits_total,

      },
      subscription: subRes.data ? {
        id: subRes.data.id,
        plan_name: subRes.data.billing_plans?.name || null,
        status: subRes.data.status,
        points_allocated: subRes.data.points_allocated,
        points_used: subRes.data.points_used,
        start_date: subRes.data.start_date,
        end_date: subRes.data.end_date,
        auto_renew: subRes.data.auto_renew,
        price_monthly_cents: subRes.data.billing_plans?.price_monthly_cents || 0,
      } : null,
      usage: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalPoints,
        totalTokens,
        totalCalls: usageLogs.length,
      },
      dailyUsage: Object.entries(dailyMap)
        .map(([date, data]) => ({
          date,
          cost: Math.round(data.cost * 100) / 100,
          points: data.points,
          tokens: data.tokens,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      actionBreakdown: Object.entries(actionBreakdown).map(([type, data]) => ({
        type,
        points: data.points,
        cost: Math.round(data.cost * 100) / 100,
        count: data.count,
      })),
      platform_breakdown: Object.entries(platformBreakdownMap).map(([platform, data]) => ({
        platform,
        points: data.points,
        calls: data.calls,
      })),
      current_plan: currentPlan,
      pointCosts,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
