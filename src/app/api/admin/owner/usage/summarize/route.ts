import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
    const to = searchParams.get('to') || new Date().toISOString();

    const { data: rows, error } = await supabase
      .from('usage_logs')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const totalCost = rows?.reduce((s, r) => s + Number(r.total_cost || 0), 0) || 0;
    const totalPoints = rows?.reduce((s, r) => s + Number(r.points_charged || 0), 0) || 0;

    const costByModel: Record<string, { cost: number; tokens: number; count: number }> = {};
    const costByProvider: Record<string, { cost: number; count: number }> = {};
    const costByActionType: Record<string, { cost: number; points: number; count: number }> = {};
    const daily: Record<string, { cost: number; tokens: number; points: number }> = {};

    for (const row of rows || []) {
      const model = row.model_name || row.model_used || 'unknown';
      const provider = row.provider_id || 'unknown';
      const action = row.action_type || 'text_reply';
      const date = row.created_at?.substring(0, 10) || 'unknown';

      if (!costByModel[model]) costByModel[model] = { cost: 0, tokens: 0, count: 0 };
      costByModel[model].cost += Number(row.total_cost || 0);
      costByModel[model].tokens += Number(row.tokens_used || 0);
      costByModel[model].count++;

      if (!costByProvider[provider]) costByProvider[provider] = { cost: 0, count: 0 };
      costByProvider[provider].cost += Number(row.total_cost || 0);
      costByProvider[provider].count++;

      if (!costByActionType[action]) costByActionType[action] = { cost: 0, points: 0, count: 0 };
      costByActionType[action].cost += Number(row.total_cost || 0);
      costByActionType[action].points += Number(row.points_charged || 0);
      costByActionType[action].count++;

      if (!daily[date]) daily[date] = { cost: 0, tokens: 0, points: 0 };
      daily[date].cost += Number(row.total_cost || 0);
      daily[date].tokens += Number(row.tokens_used || 0);
      daily[date].points += Number(row.points_charged || 0);
    }

    return NextResponse.json({
      totalCost,
      totalPointsCharged: totalPoints,
      totalTokens: { input: 0, output: 0, reasoning: 0 },
      costByModel: Object.entries(costByModel).map(([model, data]) => ({ model, ...data })),
      costByProvider: Object.entries(costByProvider).map(([provider, data]) => ({ provider, ...data })),
      costByActionType: Object.entries(costByActionType).map(([type, data]) => ({ type, ...data })),
      daily: Object.entries(daily).map(([date, data]) => ({ date, ...data })),
      totalCalls: rows?.length || 0,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
