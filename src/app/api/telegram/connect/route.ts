import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { getTelegramBotInfo, setTelegramWebhook } from '@/lib/telegram/bot';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botToken, businessId } = await request.json();
    if (!botToken) {
      return NextResponse.json({ error: 'Missing bot token' }, { status: 400 });
    }

    // Validate token by fetching bot info
    const botInfo = await getTelegramBotInfo(botToken);
    if (!botInfo) {
      return NextResponse.json({ error: 'Invalid Telegram bot token' }, { status: 400 });
    }

    const encryptedToken = encrypt(botToken);

    // Check if this specific bot token is already connected
    const { data: existing } = await supabase
      .from('telegram_bots')
      .select('id')
      .eq('bot_token', encryptedToken)
      .maybeSingle();

    // Get the app URL for webhook
    let appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'app_url')
        .maybeSingle();
      appUrl = (settings?.value as string) || 'http://localhost:3000';
    }
    // Remove protocol for path construction
    const urlObj = new URL(appUrl);
    const baseUrl = urlObj.origin;

    if (existing) {
      // Update existing bot
      await supabase
        .from('telegram_bots')
        .update({
          business_id: businessId || null,
          bot_token: encryptedToken,
          bot_username: botInfo.username || null,
        })
        .eq('id', existing.id);

      const webhookUrl = `${baseUrl}/api/webhooks/telegram/${existing.id}`;
      await setTelegramWebhook(botToken, webhookUrl);

      return NextResponse.json({ success: true, bot: botInfo });
    }

    // Insert first to get the id
    const { data: newBot } = await supabase.from('telegram_bots').insert({
      user_id: user.id,
      business_id: businessId || null,
      bot_token: encryptedToken,
      bot_username: botInfo.username || null,
      webhook_url: '',
    }).select().single();

    if (!newBot) {
      return NextResponse.json({ error: 'Failed to create bot record' }, { status: 500 });
    }

    const webhookUrl = `${baseUrl}/api/webhooks/telegram/${newBot.id}`;
    const webhookSet = await setTelegramWebhook(botToken, webhookUrl);
    if (!webhookSet) {
      await supabase.from('telegram_bots').delete().eq('id', newBot.id);
      return NextResponse.json({ error: 'Failed to set Telegram webhook. Check that your bot token is valid.' }, { status: 500 });
    }

    await supabase.from('telegram_bots').update({ webhook_url: webhookUrl }).eq('id', newBot.id);

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'telegram_connect',
      platform: 'telegram',
      metadata: { bot_username: botInfo.username },
    });

    return NextResponse.json({ success: true, bot: botInfo });
  } catch (error) {
    console.error('Telegram connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Telegram bot' },
      { status: 500 }
    );
  }
}
