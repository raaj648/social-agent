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
      .select('user_id, model_used, tokens_used, created_at')
      .not('model_used', 'is', null)
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    if (!logs) return NextResponse.json({ models: [], userUsage: [], dailyUsage: [] });

    const modelMap: Record<string, { totalTokens: number; totalCalls: number; users: Set<string> }> = {};
    const userMap: Record<string, { totalTokens: number; totalCalls: number; models: Record<string, number> }> = {};
    const dailyMap: Record<string, { totalTokens: number; totalCalls: number }> = {};

    for (const log of logs as { user_id: string; model_used: string; tokens_used: number; created_at: string }[]) {
      const model = log.model_used.replace(/^openai\//, '').replace(/^anthropic\//, '').replace(/^google\//, '');
      const day = log.created_at.split('T')[0];

      if (!modelMap[model]) modelMap[model] = { totalTokens: 0, totalCalls: 0, users: new Set() };
      modelMap[model].totalTokens += log.tokens_used || 0;
      modelMap[model].totalCalls += 1;
      modelMap[model].users.add(log.user_id);

      if (!userMap[log.user_id]) userMap[log.user_id] = { totalTokens: 0, totalCalls: 0, models: {} };
      userMap[log.user_id].totalTokens += log.tokens_used || 0;
      userMap[log.user_id].totalCalls += 1;
      userMap[log.user_id].models[model] = (userMap[log.user_id].models[model] || 0) + 1;

      if (!dailyMap[day]) dailyMap[day] = { totalTokens: 0, totalCalls: 0 };
      dailyMap[day].totalTokens += log.tokens_used || 0;
      dailyMap[day].totalCalls += 1;
    }

    const userIds = Object.keys(userMap);
    const { data: userNames } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds.length > 0 ? userIds : ['none']);

    const nameMap: Record<string, string> = {};
    for (const u of (userNames || [])) nameMap[u.id] = u.full_name || u.email || u.id;

    return NextResponse.json({
      models: Object.entries(modelMap)
        .map(([model, data]) => ({
          model,
          totalTokens: data.totalTokens,
          totalCalls: data.totalCalls,
          userCount: data.users.size,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      userUsage: Object.entries(userMap)
        .map(([id, data]) => ({
          userId: id,
          userName: nameMap[id] || id,
          totalTokens: data.totalTokens,
          totalCalls: data.totalCalls,
          models: data.models,
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls),
      dailyUsage: Object.entries(dailyMap)
        .map(([date, data]) => ({ date, totalTokens: data.totalTokens, totalCalls: data.totalCalls }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
