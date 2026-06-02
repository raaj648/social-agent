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

    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');

    const { data: logs } = await supabase
      .from('usage_logs')
      .select('user_id, model_used, tokens_used, total_cost, points_charged, input_tokens, output_tokens, created_at, action_type, provider_id')
      .not('model_used', 'is', null)
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    if (!logs) return NextResponse.json({ models: [], userUsage: [], dailyUsage: [], actionTypeBreakdown: [], providerBreakdown: [], totalCost: 0, totalPoints: 0 });

    const modelMap: Record<string, { totalTokens: number; totalCalls: number; totalCost: number; totalPoints: number; users: Set<string> }> = {};
    const userMap: Record<string, { totalTokens: number; totalCalls: number; totalCost: number; totalPoints: number; models: Record<string, number> }> = {};
    const dailyMap: Record<string, { totalTokens: number; totalCalls: number; totalCost: number; totalPoints: number }> = {};
    const actionTypeMap: Record<string, { totalCalls: number; totalCost: number; totalPoints: number; totalTokens: number }> = {};
    const providerMap: Record<string, { totalCalls: number; totalCost: number; totalPoints: number; totalTokens: number; models: Set<string> }> = {};

    for (const log of logs as { user_id: string; model_used: string; tokens_used: number; total_cost: number; points_charged: number; input_tokens: number; output_tokens: number; created_at: string; action_type: string | null; provider_id: string | null }[]) {
      const model = log.model_used.replace(/^openai\//, '').replace(/^anthropic\//, '').replace(/^google\//, '');
      const day = log.created_at.split('T')[0];

      if (!modelMap[model]) modelMap[model] = { totalTokens: 0, totalCalls: 0, totalCost: 0, totalPoints: 0, users: new Set() };
      modelMap[model].totalTokens += log.tokens_used || 0;
      modelMap[model].totalCalls += 1;
      modelMap[model].totalCost += log.total_cost || 0;
      modelMap[model].totalPoints += log.points_charged || 0;
      modelMap[model].users.add(log.user_id);

      if (!userMap[log.user_id]) userMap[log.user_id] = { totalTokens: 0, totalCalls: 0, totalCost: 0, totalPoints: 0, models: {} };
      userMap[log.user_id].totalTokens += log.tokens_used || 0;
      userMap[log.user_id].totalCalls += 1;
      userMap[log.user_id].totalCost += log.total_cost || 0;
      userMap[log.user_id].totalPoints += log.points_charged || 0;
      userMap[log.user_id].models[model] = (userMap[log.user_id].models[model] || 0) + 1;

      if (!dailyMap[day]) dailyMap[day] = { totalTokens: 0, totalCalls: 0, totalCost: 0, totalPoints: 0 };
      dailyMap[day].totalTokens += log.tokens_used || 0;
      dailyMap[day].totalCalls += 1;
      dailyMap[day].totalCost += log.total_cost || 0;
      dailyMap[day].totalPoints += log.points_charged || 0;

      const actType = log.action_type || 'unknown';
      if (!actionTypeMap[actType]) actionTypeMap[actType] = { totalCalls: 0, totalCost: 0, totalPoints: 0, totalTokens: 0 };
      actionTypeMap[actType].totalCalls += 1;
      actionTypeMap[actType].totalCost += log.total_cost || 0;
      actionTypeMap[actType].totalPoints += log.points_charged || 0;
      actionTypeMap[actType].totalTokens += log.tokens_used || 0;

      if (log.provider_id) {
        if (!providerMap[log.provider_id]) providerMap[log.provider_id] = { totalCalls: 0, totalCost: 0, totalPoints: 0, totalTokens: 0, models: new Set() };
        providerMap[log.provider_id].totalCalls += 1;
        providerMap[log.provider_id].totalCost += log.total_cost || 0;
        providerMap[log.provider_id].totalPoints += log.points_charged || 0;
        providerMap[log.provider_id].totalTokens += log.tokens_used || 0;
        providerMap[log.provider_id].models.add(log.model_used);
      }
    }

    const userIds = Object.keys(userMap);
    const { data: userNames } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds.length > 0 ? userIds : ['none']);

    const nameMap: Record<string, string> = {};
    for (const u of (userNames || [])) nameMap[u.id] = u.full_name || u.email || u.id;

    // Resolve provider names
    const providerIds = Object.keys(providerMap);
    const { data: providers } = await supabase
      .from('ai_providers')
      .select('id, name')
      .in('id', providerIds.length > 0 ? providerIds : ['none']);
    const providerNameMap: Record<string, string> = {};
    for (const p of (providers || [])) providerNameMap[p.id] = p.name;

    return NextResponse.json({
      models: Object.entries(modelMap)
        .map(([model, data]) => ({
          model,
          totalTokens: data.totalTokens,
          totalCalls: data.totalCalls,
          totalCost: Math.round(data.totalCost * 100) / 100,
          totalPoints: data.totalPoints,
          userCount: data.users.size,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      userUsage: Object.entries(userMap)
        .map(([id, data]) => ({
          userId: id,
          userName: nameMap[id] || id,
          totalTokens: data.totalTokens,
          totalCalls: data.totalCalls,
          totalCost: Math.round(data.totalCost * 100) / 100,
          totalPoints: data.totalPoints,
          models: data.models,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      dailyUsage: Object.entries(dailyMap)
        .map(([date, data]) => ({ date, totalTokens: data.totalTokens, totalCalls: data.totalCalls, totalCost: Math.round(data.totalCost * 100) / 100, totalPoints: data.totalPoints }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      actionTypeBreakdown: Object.entries(actionTypeMap)
        .map(([type, data]) => ({
          type,
          totalCalls: data.totalCalls,
          totalCost: Math.round(data.totalCost * 100) / 100,
          totalPoints: data.totalPoints,
          totalTokens: data.totalTokens,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      providerBreakdown: Object.entries(providerMap)
        .map(([id, data]) => ({
          providerId: id,
          providerName: providerNameMap[id] || id,
          totalCalls: data.totalCalls,
          totalCost: Math.round(data.totalCost * 100) / 100,
          totalPoints: data.totalPoints,
          totalTokens: data.totalTokens,
          modelsCount: data.models.size,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      totalCost: Math.round(Object.values(modelMap).reduce((s, m) => s + m.totalCost, 0) * 100) / 100,
      totalPoints: Object.values(modelMap).reduce((s, m) => s + m.totalPoints, 0),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
