import { NextRequest, NextResponse } from 'next/server';
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
    const { data: templates } = await supabase
      .from('announcement_templates')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const { title, message, targetAudience } = await request.json();
    if (!title || !message) return NextResponse.json({ error: 'title and message required' }, { status: 400 });

    if (targetAudience === 'all' || targetAudience === 'specific') {
      const { data: users } = await supabase.from('users').select('id, email, full_name');
      const recipients = targetAudience === 'specific'
        ? users?.filter(u => u.id === targetAudience) || []
        : users || [];

      const { error: insertError } = await supabase.from('announcements').insert({
        title,
        message,
        created_by: user.id,
        target_audience: targetAudience,
        recipient_count: recipients.length,
      });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
