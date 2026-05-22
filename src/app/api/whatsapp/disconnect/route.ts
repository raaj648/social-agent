import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing account ID' }, { status: 400 });
    }

    await supabase
      .from('whatsapp_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect WhatsApp' },
      { status: 500 }
    );
  }
}
