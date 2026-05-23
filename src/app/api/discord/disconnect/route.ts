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
      return NextResponse.json({ error: 'Missing bot id' }, { status: 400 });
    }

    const { data: bot } = await supabase
      .from('discord_bots')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'Discord bot not found' }, { status: 404 });
    }

    await supabase.from('discord_bots').delete().eq('id', id);

    // Disconnect conversations
    await supabase
      .from('conversations')
      .update({ discord_id: null, ai_enabled: false })
      .eq('discord_id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Discord disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect Discord bot' },
      { status: 500 }
    );
  }
}
