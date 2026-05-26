import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { DISCORD_PERMISSIONS_BITS } from '@/lib/discord/bot';

export async function POST(request: NextRequest) {
  try {
    const { botId } = await request.json();
    if (!botId) {
      return NextResponse.json({ error: 'Missing botId' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: bot } = await supabase
      .from('discord_bots')
      .select('bot_token, guild_id')
      .eq('id', botId)
      .single();

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const botToken = decrypt(bot.bot_token);
    if (!botToken) {
      return NextResponse.json({ error: 'Failed to decrypt bot token' }, { status: 500 });
    }

    // Fetch guilds the bot is in (includes permissions field)
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Discord API error' }, { status: 502 });
    }
    const guilds: any[] = await res.json();

    // Find the matching guild
    const guild = guilds.find((g: any) => g.id === bot.guild_id);
    if (!guild) {
      return NextResponse.json({ error: 'Bot not in guild' }, { status: 404 });
    }

    const currentPerms = BigInt(guild.permissions);
    const targetPerms = BigInt(464497527872);

    // Check which bits are missing
    const missing: string[] = [];
    for (const [label, bit] of Object.entries(DISCORD_PERMISSIONS_BITS)) {
      const bitVal = BigInt(bit as number);
      if ((targetPerms & bitVal) !== BigInt(0) && (currentPerms & bitVal) === BigInt(0)) {
        missing.push(label);
      }
    }

    return NextResponse.json({
      ok: missing.length === 0,
      missing,
      currentPermissions: guild.permissions,
    });
  } catch (error) {
    console.error('check-permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
