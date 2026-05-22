import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const { data: targetUser } = await supabase.from('users').select('id, email, full_name').eq('id', userId).single();
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      user: targetUser,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
