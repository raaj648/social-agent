import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { editDiscordInteractionResponse } from '@/lib/discord/bot';
import { handleAIResponse } from '@/lib/ai/handler';
import type { AISettings } from '@/types';

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
    resolved?: {
      attachments?: Record<string, unknown>;
    };
  };
}

export async function processDiscordInteraction(interaction: DiscordInteraction): Promise<{
  type: number;
  data?: { content: string };
} | void> {
  // PING verification
  if (interaction.type === 1) {
    return { type: 1 };
  }

  // Slash command
  if (interaction.type === 2 && interaction.data?.name === 'chat') {
    const messageText = interaction.data?.options?.find((o) => o.name === 'message')?.value as string;
    if (!messageText) {
      await editDiscordInteractionResponse(
        interaction.application_id,
        interaction.token,
        'Please provide a message. Usage: `/chat <message>`'
      );
      return;
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
      await editDiscordInteractionResponse(
        interaction.application_id,
        interaction.token,
        'This server is not configured with an AI bot. Please contact the server admin.'
      );
      return;
    }

    const user = matchedBot.user as any;
    if (!user?.is_active) {
      await editDiscordInteractionResponse(
        interaction.application_id,
        interaction.token,
        'Bot is disabled.'
      );
      return;
    }

    const botToken = decrypt(matchedBot.bot_token);
    const channelField = 'discord_id';
    const channelDbId = matchedBot.id;

    // Find or create conversation + get AI settings in parallel
    const [convResponse, aiResponse] = await Promise.all([
      supabase
        .from('conversations')
        .select('*')
        .eq('user_id', matchedBot.user_id)
        .eq('sender_id', discordUserId)
        .eq('platform', 'discord')
        .single(),
      supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', matchedBot.user_id)
        .eq('discord_id', channelDbId)
        .maybeSingle(),
    ]);

    let conversation = convResponse.data;
    let aiSettings = aiResponse.data;

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
        await editDiscordInteractionResponse(
          interaction.application_id,
          interaction.token,
          'Failed to create conversation.'
        );
        return;
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
      await editDiscordInteractionResponse(
        interaction.application_id,
        interaction.token,
        'AI is currently paused for this conversation.'
      );
      return;
    }

    // AI settings fallback
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

    // In-memory defaults fallback — consistent with Meta and Telegram webhooks
    if (!aiSettings) {
      aiSettings = {
        is_active: true,
        model: 'openai/gpt-4o-mini',
        temperature: null,
        max_tokens: null,
        conversation_memory_count: 10,
        system_prompt: null,
        fallback_response: '',
        greeting_enabled: false,
        greeting_message: null,
        business_hours_only: false,
        business_hours_start: null,
        business_hours_end: null,
        timezone: 'UTC',
        keywords_blacklist: [],
        id: '',
        user_id: matchedBot.user_id,
        business_id: null,
        page_id: null,
        instagram_id: null,
        telegram_id: null,
        discord_id: null,
      } as unknown as AISettings;
    }

    if (!aiSettings?.is_active) {
      await editDiscordInteractionResponse(
        interaction.application_id,
        interaction.token,
        'AI responses are disabled.'
      );
      return;
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

    // Edit deferred response with thinking message
    await editDiscordInteractionResponse(
      interaction.application_id,
      interaction.token,
      `?? **${discordUsername}** asked: "${messageText}"\n\n*Thinking...*`
    );

    // Await AI handler — keeps the promise alive so waitUntil() in the route
    // prevents Vercel from terminating the function before the reply is sent.
    const discordHasMedia = !!(interaction.data?.resolved?.attachments && Object.keys(interaction.data.resolved.attachments).length > 0);
    await handleAIResponse(
      matchedBot.user_id,
      matchedBot.user_id,
      channelId,
      null,
      null,
      conversationId,
      discordUserId,
      messageText,
      botToken,
      'discord',
      aiSettings as AISettings,
      discordHasMedia
    );

    return;
  }

  // Unknown command
  await editDiscordInteractionResponse(
    interaction.application_id,
    interaction.token,
    'Unknown command.'
  );
}