import { getDiscordPublicKey } from '@/lib/credentials';
import crypto from 'crypto';

const DISCORD_API = 'https://discord.com/api/v10';

export const DISCORD_PERMISSIONS_BITS: Record<string, number> = {
  VIEW_CHANNEL: 1024,
  SEND_MESSAGES: 2048,
  MANAGE_MESSAGES: 8192,
  EMBED_LINKS: 16384,
  ATTACH_FILES: 32768,
  READ_MESSAGE_HISTORY: 65536,
  USE_EXTERNAL_EMOJI: 262144,
  CONNECT: 1048576,
  SPEAK: 2097152,
  USE_VAD: 33554432,
  CHANGE_NICKNAME: 67108864,
  MANAGE_THREADS: 17179869184,
  CREATE_PUBLIC_THREADS: 34359738368,
  USE_EXTERNAL_STICKERS: 137438953472,
  SEND_MESSAGES_IN_THREADS: 274877906944,
  MANAGE_WEBHOOKS: 536870912,
};

export async function sendDiscordMessage(
  botToken: string,
  channelId: string,
  text: string,
  interactionAppId?: string,
  interactionToken?: string,
  webhookName?: string
): Promise<boolean> {
  try {
    // 1. Channel webhook (requires MANAGE_WEBHOOKS) — no badge, clean name
    if (interactionAppId && interactionToken && webhookName) {
      const webhook = await ensureChannelWebhook(botToken, channelId, webhookName);
      if (webhook) {
        const sent = await sendViaWebhook(webhook.id, webhook.token, text);
        if (sent) {
          await deleteInteractionResponse(interactionAppId, interactionToken);
          return true;
        }
      } else {
        console.warn('Discord webhook: ensureChannelWebhook returned null (MANAGE_WEBHOOKS missing?)');
      }
    }
    // 2. Bot token channel POST (requires SEND_MESSAGES) — shows "BOT" badge
    if (interactionAppId && interactionToken) {
      const postUrl = `${DISCORD_API}/channels/${channelId}/messages`;
      const postRes = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify({ content: text }),
      });
      if (postRes.ok) {
        await deleteInteractionResponse(interactionAppId, interactionToken);
        return true;
      }
    }
    // 3. Interaction webhook PATCH (always works) — shows "APP" badge (last resort)
    if (interactionAppId && interactionToken) {
      const url = `${DISCORD_API}/webhooks/${interactionAppId}/${interactionToken}/messages/@original`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('Discord webhook PATCH error (channel:', channelId, '):', res.status, errBody);
        return false;
      }
      return true;
    }
    // No interaction context — direct channel POST
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
      const errBody = await res.text();
      console.error('Discord sendMessage error (channel:', channelId, '):', res.status, res.statusText, errBody);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord sendMessage exception:', error);
    return false;
  }
}

export async function renameDiscordApp(botToken: string, name: string): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/applications/@me`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({ name }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getBotAvatarDataUri(botToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    if (!data.avatar) return undefined;
    const ext = data.avatar.startsWith('a_') ? 'gif' : 'png';
    const imgRes = await fetch(`https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}`);
    if (!imgRes.ok) return undefined;
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return `data:image/${ext};base64,${base64}`;
  } catch {
    return undefined;
  }
}

export async function ensureChannelWebhook(
  botToken: string,
  channelId: string,
  name: string
): Promise<{ id: string; token: string } | null> {
  try {
    const listUrl = `${DISCORD_API}/channels/${channelId}/webhooks`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (listRes.ok) {
      const webhooks: any[] = await listRes.json();
      const existing = webhooks.find((w: any) => w.name === name);
      if (existing) return { id: existing.id, token: existing.token };
    }

    const avatar = await getBotAvatarDataUri(botToken);
    const createUrl = `${DISCORD_API}/channels/${channelId}/webhooks`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({ name, ...(avatar ? { avatar } : {}) }),
    });
    if (!createRes.ok) return null;
    const data = await createRes.json();
    return { id: data.id, token: data.token };
  } catch {
    return null;
  }
}

export async function sendViaWebhook(webhookId: string, webhookToken: string, content: string): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/webhooks/${webhookId}/${webhookToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('Discord webhook send error:', res.status, errBody);
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteInteractionResponse(applicationId: string, interactionToken: string): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      console.error('Discord deleteInteractionResponse error:', res.status);
    }
    return res.ok;
  } catch (error) {
    console.error('Discord deleteInteractionResponse exception:', error);
    return false;
  }
}

export async function setBotNickname(botToken: string, guildId: string, nickname: string): Promise<boolean> {
  try {
    const url = `${DISCORD_API}/guilds/${guildId}/members/@me`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify({ nick: nickname }),
    });
    return res.ok;
  } catch {
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
    if (!res.ok) {
      const errBody = await res.text();
      console.error('Discord editInteractionResponse error:', res.status, errBody);
    }
    return res.ok;
  } catch (error) {
    console.error('Discord editInteractionResponse exception:', error);
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
  botToken: string,
  commandName: string = 'chat'
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
          name: commandName,
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
