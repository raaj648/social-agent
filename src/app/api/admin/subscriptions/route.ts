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

    const search = request.nextUrl.searchParams.get('search') || '';
    const status = request.nextUrl.searchParams.get('status') || '';
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('user_subscriptions')
      .select('*, billing_plans!inner(name, price_monthly_cents, daily_quota), users!inner(id, email, full_name)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`users.email.ilike.%${search}%,users.full_name.ilike.%${search}%`);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ subscriptions: data || [], total: count || 0, page, limit });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const body = await request.json();

    if (!body.id) return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.plan_id) updateData.plan_id = body.plan_id;
    if (body.auto_renew !== undefined) updateData.auto_renew = body.auto_renew;
    if (body.points_allocated !== undefined) updateData.points_allocated = body.points_allocated;
    if (body.points_used !== undefined) updateData.points_used = body.points_used;
    if (body.end_date !== undefined) updateData.end_date = body.end_date;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(updateData)
      .eq('id', body.id)
      .select('*, billing_plans(name, price_monthly_cents, daily_quota), users(id, email, full_name)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ subscription: data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
