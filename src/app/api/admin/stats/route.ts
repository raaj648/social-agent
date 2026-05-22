import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await createAdminClient();
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: platformStats } = await supabase.rpc('get_platform_stats');
    const { data: dailyRegistrations } = await supabase.rpc('get_daily_registrations', { days: 7 });
    const { data: recentUsers } = await supabase
      .from('users')
      .select('id, email, full_name, plan, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: recentActivity } = await supabase
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const userIds = Array.from(new Set((recentActivity || []).map((l: any) => l.user_id).filter(Boolean))) as string[];
    let userMap: Record<string, { email: string; full_name: string }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);
      for (const u of (users || [])) {
        userMap[u.id] = { email: u.email, full_name: u.full_name };
      }
    }

    const enrichedActivity = (recentActivity || []).map((l: any) => ({
      ...l,
      user: userMap[l.user_id] || { email: 'Unknown', full_name: 'Unknown' },
    }));

    const { data: planDistribution } = await supabase
      .from('users')
      .select('plan');

    const planCounts: Record<string, number> = {};
    if (planDistribution) {
      for (const u of planDistribution) {
        planCounts[u.plan] = (planCounts[u.plan] || 0) + 1;
      }
    }

    return NextResponse.json({
      stats: platformStats?.[0] || {},
      dailyRegistrations: dailyRegistrations || [],
      recentUsers: recentUsers || [],
      recentActivity: enrichedActivity,
      planDistribution: planCounts,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
