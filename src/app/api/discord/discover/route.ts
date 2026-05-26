import { NextRequest, NextResponse } from 'next/server';
import { getDiscordBotInfo, getDiscordUserGuilds, getDiscordGuildChannels } from '@/lib/discord/bot';

export async function POST(request: NextRequest) {
  try {
    const { botToken, guildId } = await request.json();

    if (!botToken) {
      return NextResponse.json({ error: 'Missing bot token' }, { status: 400 });
    }

    // Validate token first
    const botInfo = await getDiscordBotInfo(botToken);
    if (!botInfo) {
      return NextResponse.json({ error: 'Invalid Discord bot token' }, { status: 400 });
    }

    // If guildId provided, fetch channels for that guild
    if (guildId) {
      const channels = await getDiscordGuildChannels(botToken, guildId);
      const textChannels = channels
        .filter((c) => c.type === 0)
        .map((c) => ({ id: c.id, name: c.name }));
      return NextResponse.json({ channels: textChannels, botInfo });
    }

    // Otherwise fetch guilds (servers) the bot is in
    const guilds = await getDiscordUserGuilds(botToken);
    return NextResponse.json({ guilds, botInfo });
  } catch (error) {
    console.error('Discord discover error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover Discord resources' },
      { status: 500 }
    );
  }
}
