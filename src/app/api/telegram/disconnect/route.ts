import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { deleteTelegramWebhook } from '@/lib/telegram/bot';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'No Telegram bot found' }, { status: 404 });
    }

    // Delete webhook from Telegram
    try {
      const token = decrypt(bot.bot_token);
      await deleteTelegramWebhook(token);
    } catch {
      // Non-critical
    }

    await supabase.from('telegram_bots').delete().eq('id', bot.id);

    // Disconnect conversations
    await supabase
      .from('conversations')
      .update({ telegram_id: null, ai_enabled: false })
      .eq('telegram_id', bot.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect Telegram bot' },
      { status: 500 }
    );
  }
}
