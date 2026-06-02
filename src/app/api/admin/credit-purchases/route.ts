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
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('credit_purchases')
      .select('*, user:user_id(id, email, full_name), pack:pack_id(id, name, slug)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`user_id.ilike.%${search}%,reference_id.ilike.%${search}%`);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ purchases: data || [], total: count || 0, page, limit });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const body = await request.json();
    const { id, status, admin_note } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Purchase ID and status are required' }, { status: 400 });
    }

    if (status === 'approved') {
      const { data: approved, error: approveError } = await supabase.rpc('approve_credit_purchase', {
        p_purchase_id: id,
        p_admin_id: user.id,
        p_admin_note: admin_note || null,
      });

      if (approveError) return NextResponse.json({ error: approveError.message }, { status: 500 });
      if (!approved) return NextResponse.json({ error: 'Purchase is not in pending status' }, { status: 400 });

      const { data: purchase } = await supabase
        .from('credit_purchases')
        .select('*, user:user_id(id, email, full_name), pack:pack_id(id, name, slug)')
        .eq('id', id)
        .single();

      return NextResponse.json({ purchase });
    }

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (admin_note !== undefined) updates.admin_note = admin_note;

    const { data, error } = await supabase
      .from('credit_purchases')
      .update(updates)
      .eq('id', id)
      .select('*, user:user_id(id, email, full_name), pack:pack_id(id, name, slug)')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ purchase: data });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
