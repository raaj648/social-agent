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
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, email, full_name, plan, role, is_active, business_name, created_at, credits_remaining, credits_total', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const enriched = await Promise.all(
      (users || []).map(async (u: any) => {
        const { count: fbPages } = await supabase
          .from('connected_pages').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        const { count: igAccts } = await supabase
          .from('instagram_accounts').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        const { count: waAccts } = await supabase
          .from('whatsapp_accounts').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        const { count: convCount } = await supabase
          .from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', u.id);
        const { data: usage } = await supabase
          .from('usage_logs').select('tokens_used')
          .eq('user_id', u.id)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
        const tokens30d = ((usage || []) as { tokens_used: number }[]).reduce((s, u) => s + (u.tokens_used || 0), 0);
        return {
          id: u.id,
          name: u.full_name || u.email,
          slug: u.email?.split('@')[0] || u.id,
          owner_id: u.id,
          email: u.email,
          plan: u.plan,
          is_active: u.is_active,
          created_at: u.created_at,
          fbPages: fbPages || 0,
          igAccounts: igAccts || 0,
          waAccounts: waAccts || 0,
          conversations: convCount || 0,
          tokens30d,
          owner: { email: u.email, full_name: u.full_name, plan: u.plan },
        };
      })
    );

    return NextResponse.json({ tenants: enriched, total: count || 0, page, limit });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
