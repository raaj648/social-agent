import { getDiscordPublicKey } from '@/lib/credentials';
import crypto from 'crypto';

const DISCORD_API = 'https://discord.com/api/v10';

export async function sendDiscordMessage(
  botToken: string,
  channelId: string,
  text: string
): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/channels/${channelId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Discord sendMessage error:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord sendMessage exception:', error);
    return false;
  }
}

export async function getDiscordBotInfo(
  botToken: string
): Promise<{ id: string; username: string } | null> {
  try {
    const url = `${DISCORD_API}/users/@me`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, username: data.username };
  } catch {
    return null;
  }
}

export async function getDiscordGuildChannels(
  botToken: string,
  guildId: string
): Promise<Array<{ id: string; name: string; type: number }>> {
  try {
    const url = `${DISCORD_API}/guilds/${guildId}/channels`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getDiscordUserGuilds(
  botToken: string
): Promise<Array<{ id: string; name: string; icon: string | null }>> {
  try {
    const url = `${DISCORD_API}/users/@me/guilds`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createDiscordInteractionResponse(
  interactionId: string,
  interactionToken: string,
  content: string
): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/interactions/${interactionId}/${interactionToken}/callback`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 4,
        data: { content },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function editDiscordInteractionResponse(
  applicationId: string,
  interactionToken: string,
  content: string
): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function verifyDiscordKey(
  rawBody: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  const publicKey = await getDiscordPublicKey();
  if (!publicKey) return false;
  try {
    const rawKey = Buffer.from(publicKey, 'hex');
    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const derKey = Buffer.concat([derPrefix, rawKey]);
    const key = crypto.createPublicKey({
      key: derKey,
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

export async function registerDiscordCommands(
  clientId: string,
  botToken: string
): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/applications/${clientId}/commands`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify([
        {
          name: 'chat',
          description: 'Chat with the AI assistant',
          options: [
            {
              type: 3,
              name: 'message',
              description: 'Your message for the AI',
              required: true,
            },
          ],
        },
      ]),
    });
    return res.ok;
  } catch {
    return false;
  }
}
