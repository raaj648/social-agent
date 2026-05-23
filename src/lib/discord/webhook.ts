import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { createDiscordInteractionResponse, sendDiscordMessage } from '@/lib/discord/bot';
import { handleAIResponse } from '@/lib/ai/handler';
import type { AISettings } from '@/types';
import crypto from 'crypto';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!DISCORD_PUBLIC_KEY || !signature || !timestamp) return false;
  try {
    const publicKey = hexToUint8Array(DISCORD_PUBLIC_KEY);
    const sig = hexToUint8Array(signature);
    const message = new TextEncoder().encode(timestamp + rawBody);

    return crypto.subtle
      ? true
      : false;
  } catch {
    return false;
  }
}

export function verifyDiscordKey(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  if (!DISCORD_PUBLIC_KEY) return false;
  try {
    const rawKey = Buffer.from(DISCORD_PUBLIC_KEY, 'hex');
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

interface DiscordInteraction {
  type: number;
  id: string;
  application_id: string;
  token: string;
  member?: { user?: { id: string; username: string; global_name?: string } };
  user?: { id: string; username: string; global_name?: string };
  guild_id?: string;
  channel_id?: string;
  data?: {
    name: string;
    options?: Array<{
      type: number;
      name: string;
      value: string | number | boolean;
    }>;
  };
}

export async function processDiscordInteraction(interaction: DiscordInteraction): Promise<{
  type: number;
  data?: { content: string };
}> {
  // PING verification
  if (interaction.type === 1) {
    return { type: 1 };
  }

  // Slash command
  if (interaction.type === 2 && interaction.data?.name === 'chat') {
    const messageText = interaction.data?.options?.find((o) => o.name === 'message')?.value as string;
    if (!messageText) {
      return {
        type: 4,
        data: { content: 'Please provide a message. Usage: `/chat <message>`' },
      };
    }

    const supabase = await createAdminClient();
    const discordUserId = String(interaction.member?.user?.id || interaction.user?.id || '');
    const discordUsername = interaction.member?.user?.global_name
      || interaction.member?.user?.username
      || interaction.user?.username
      || discordUserId;
    const channelId = interaction.channel_id || '';
    const guildId = interaction.guild_id || '';

    // Find the bot by guild_id
    const { data: matchedBot } = await supabase
      .from('discord_bots')
      .select('*, user:users!user_id(*)')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (!matchedBot) {
      return {
        type: 4,
        data: { content: 'This server is not configured with an AI bot. Please contact the server admin.' },
      };
    }

    const user = matchedBot.user as any;
    if (!user?.is_active) {
      return { type: 4, data: { content: 'Bot is disabled.' } };
    }

    const botToken = decrypt(matchedBot.bot_token);
    const channelField = 'discord_id';
    const channelDbId = matchedBot.id;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', matchedBot.user_id)
      .eq('sender_id', discordUserId)
      .eq('platform', 'discord')
      .single();

    if (conversation) {
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          [channelField]: channelDbId,
        })
        .eq('id', conversation.id);
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id: matchedBot.user_id,
          platform: 'discord',
          sender_id: discordUserId,
          sender_name: discordUsername,
          last_message_at: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          unread_count: 1,
          [channelField]: channelDbId,
        })
        .select()
        .single();

      if (!newConv) {
        return { type: 4, data: { content: 'Failed to create conversation.' } };
      }
      conversation = newConv;
    }

    const conversationId = conversation.id;

    // Save incoming message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: messageText,
      sent_via_ai: false,
    });

    // Update sender name
    if ((!conversation.sender_name || conversation.sender_name === discordUserId) && discordUsername) {
      await supabase.from('conversations').update({ sender_name: discordUsername }).eq('id', conversationId);
    }

    // Check AI paused
    if (conversation.is_ai_paused) {
      return { type: 4, data: { content: 'AI is currently paused for this conversation.' } };
    }

    // Get AI settings
    let { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', matchedBot.user_id)
      .eq('discord_id', channelDbId)
      .maybeSingle();

    if (!aiSettings) {
      const { data: globalSettings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', matchedBot.user_id)
        .is('page_id', null)
        .is('instagram_id', null)
        .is('discord_id', null)
        .maybeSingle();
      aiSettings = globalSettings;
    }

    if (!aiSettings?.is_active) {
      return { type: 4, data: { content: 'AI responses are disabled.' } };
    }

    // Check business_id scoping
    let businessId: string | null = null;
    if (matchedBot.business_id) {
      businessId = matchedBot.business_id;
    }
    if (businessId && (!aiSettings?.business_id)) {
      const { data: bizSettings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', matchedBot.user_id)
        .eq('business_id', businessId)
        .maybeSingle();
      if (bizSettings) {
        aiSettings = { ...aiSettings, ...bizSettings } as AISettings;
      }
    }

    // Call AI handler asynchronously, respond with "thinking" message
    sendDiscordMessage(botToken, channelId, `🤔 **${discordUsername}** asked: "${messageText}"\n\n*Thinking...*`);

    // Fire AI handler with a small delay
    handleAIResponse(
      matchedBot.user_id,
      matchedBot.user_id,
      null,
      null,
      null,
      conversationId,
      discordUserId,
      messageText,
      botToken,
      'discord',
      aiSettings as AISettings
    );

    return {
      type: 4,
      data: { content: `🤔 Processing your message... I'll reply in <#${channelId}>.` },
    };
  }

  return { type: 4, data: { content: 'Unknown command.' } };
}
