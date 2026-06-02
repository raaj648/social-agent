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

    // Average cost per user (last 30d)
    const { data: costs } = await supabase
      .from('usage_logs')
      .select('user_id, total_cost, points_charged')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());

    const userCosts: Record<string, { cost: number; points: number }> = {};
    for (const row of (costs || []) as any[]) {
      if (!userCosts[row.user_id]) userCosts[row.user_id] = { cost: 0, points: 0 };
      userCosts[row.user_id].cost += row.total_cost || 0;
      userCosts[row.user_id].points += row.points_charged || 0;
    }

    const users = Object.values(userCosts);
    const avgCost = users.length > 0 ? users.reduce((s, u) => s + u.cost, 0) / users.length : 0;
    const avgPoints = users.length > 0 ? users.reduce((s, u) => s + u.points, 0) / users.length : 0;

    // Get all plans
    const { data: plans } = await supabase
      .from('billing_plans')
      .select('id, name, price_monthly_cents, monthly_quota')
      .order('sort_order', { ascending: true });

    const estimates = (plans || []).map((plan: any) => {
      const price = (plan.price_monthly_cents || 0) / 100;
      const costPerUser = avgCost;
      const profit = price - costPerUser;
      const margin = price > 0 ? Math.round((profit / price) * 100 * 10) / 10 : 0;
      return {
        plan_id: plan.id,
        plan_name: plan.name,
        price_monthly: price,
        points_per_month: plan.monthly_quota || 0,
        avg_cost_per_user: Math.round(costPerUser * 10000) / 10000,
        avg_points_per_user: Math.round(avgPoints),
        estimated_profit: Math.round(profit * 100) / 100,
        profit_margin_pct: margin,
        active_users_30d: Object.keys(userCosts).length,
      };
    });

    return NextResponse.json({ estimates, globalAvgCost: Math.round(avgCost * 10000) / 10000, globalAvgPoints: Math.round(avgPoints) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
