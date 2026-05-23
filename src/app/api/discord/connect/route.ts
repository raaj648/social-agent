import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { getDiscordBotInfo, registerDiscordCommands } from '@/lib/discord/bot';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { botToken, clientId, guildId, channelId, businessId } = await request.json();
    if (!botToken) {
      return NextResponse.json({ error: 'Missing bot token' }, { status: 400 });
    }

    // Validate token
    const botInfo = await getDiscordBotInfo(botToken);
    if (!botInfo) {
      return NextResponse.json({ error: 'Invalid Discord bot token' }, { status: 400 });
    }

    const encryptedToken = encrypt(botToken);

    // Check if already connected for this guild
    const { data: existing } = await supabase
      .from('discord_bots')
      .select('id')
      .eq('user_id', user.id)
      .eq('guild_id', guildId || '')
      .maybeSingle();

    if (existing) {
      await supabase
        .from('discord_bots')
        .update({
          business_id: businessId || null,
          bot_token: encryptedToken,
          client_id: clientId || botInfo.id,
          guild_id: guildId || null,
          channel_id: channelId || null,
          bot_username: botInfo.username,
        })
        .eq('id', existing.id);

      // Register slash commands
      if (clientId || botInfo.id) {
        await registerDiscordCommands(clientId || botInfo.id, botToken);
      }

      return NextResponse.json({ success: true, bot: botInfo });
    }

    // Register slash commands
    if (clientId || botInfo.id) {
      await registerDiscordCommands(clientId || botInfo.id, botToken);
    }

    await supabase.from('discord_bots').insert({
      user_id: user.id,
      business_id: businessId || null,
      bot_token: encryptedToken,
      client_id: clientId || botInfo.id,
      guild_id: guildId || null,
      channel_id: channelId || null,
      bot_username: botInfo.username,
    });

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'discord_connect',
      platform: 'discord',
      metadata: { bot_username: botInfo.username, guild_id: guildId },
    });

    return NextResponse.json({ success: true, bot: botInfo });
  } catch (error) {
    console.error('Discord connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect Discord bot' },
      { status: 500 }
    );
  }
}
