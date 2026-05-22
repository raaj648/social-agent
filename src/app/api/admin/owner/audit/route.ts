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
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('usage_logs')
      .select('*, users!inner(email, full_name)', { count: 'exact' })
      .limit(limit);

    if (action !== 'all') query = query.eq('action', action);
    if (search) {
      query = query.or(
        `users.email.ilike.%${search}%,users.full_name.ilike.%${search}%`
      );
    }

    const { data: logs, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const entries = (logs || []).map((l: Record<string, unknown>) => ({
      id: l.id,
      action: l.action,
      platform: l.platform,
      tokensUsed: l.tokens_used,
      modelUsed: l.model_used,
      metadata: l.metadata,
      ipAddress: l.ip_address,
      createdAt: l.created_at,
      userEmail: (l.users as Record<string, unknown>)?.email || '',
      userName: (l.users as Record<string, unknown>)?.full_name || '',
    }));

    return NextResponse.json({ logs: entries, total: count || 0, page, limit });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
