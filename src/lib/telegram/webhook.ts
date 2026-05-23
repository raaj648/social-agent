import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { sendTelegramMessage } from '@/lib/telegram/bot';
import { handleAIResponse } from '@/lib/ai/handler';
import type { AISettings } from '@/types';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
    chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string };
    text?: string;
    date: number;
  };
}

const DEFAULT_AI_SETTINGS: AISettings = {
  is_active: true,
  model: 'openai/gpt-4o-mini',
  temperature: 0.7,
  max_tokens: 500,
  conversation_memory_count: 10,
  system_prompt: null,
  greeting_message: null,
  greeting_enabled: false,
  keywords_blacklist: [],
  business_hours_only: false,
  business_hours_start: null,
  business_hours_end: null,
  timezone: null,
  fallback_response: null,
  human_handoff_enabled: false,
  agent_display_name: null,
  ai_agent_name: null,
  agent_role: null,
  business_name: null,
  page_id: null,
  instagram_id: null,
  telegram_id: null,
  whatsapp_id: null,
  discord_id: null,
  business_id: null,
};

export async function processTelegramUpdate(update: TelegramUpdate, botId?: string): Promise<void> {
  if (!update.message?.text || !update.message?.chat) {
    console.warn('Telegram update skipped: no text or chat', { update_id: update.update_id });
    return;
  }

  const supabase = await createAdminClient();
  const chatId = String(update.message.chat.id);
  const messageText = update.message.text;
  const senderId = String(update.message.from?.id || chatId);
  const senderName = update.message.from?.first_name
    ? [update.message.from.first_name, update.message.from.last_name].filter(Boolean).join(' ')
    : update.message.chat.title || senderId;

  // Look up the specific bot by ID from the webhook URL, or by token lookup
  let matchedBot: any = null;

  if (botId) {
    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('*, user:users!user_id(*)')
      .eq('id', botId)
      .maybeSingle();
    matchedBot = bot;
    if (!matchedBot) {
      console.warn('Telegram bot not found for id:', botId);
      return;
    }
  } else {
    // Fallback: try to match by mention in group chats
    if (update.message.chat.type === 'private') {
      console.warn('Telegram mention matching skipped: private chat, no botId');
      return;
    }

    const { data: bots } = await supabase.from('telegram_bots').select('*, user:users!user_id(*)');
    if (!bots || bots.length === 0) {
      console.warn('Telegram mention matching skipped: no bots found');
      return;
    }

    const lowerMsg = messageText.toLowerCase();
    matchedBot = bots.find((b: any) =>
      b.bot_username && lowerMsg.includes(`@${b.bot_username.toLowerCase()}`)
    );
    if (!matchedBot) {
      console.warn('Telegram mention matching: no matching bot username in message');
      return;
    }
  }

  if (!matchedBot) return;

  const user = matchedBot.user as any;
  if (!user?.is_active) {
    console.warn('Telegram update skipped: user inactive', { user_id: matchedBot.user_id });
    return;
  }

  if (matchedBot.is_active === false) {
    console.warn('Telegram update skipped: bot inactive', { bot_id: matchedBot.id });
    return;
  }

  let botToken: string;
  try {
    botToken = decrypt(matchedBot.bot_token);
  } catch {
    console.error('Telegram decrypt failed for bot:', matchedBot.id);
    return;
  }

  const channelField = 'telegram_id';
  const channelDbId = matchedBot.id;

  // Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', matchedBot.user_id)
    .eq('sender_id', senderId)
    .eq('platform', 'telegram')
    .maybeSingle();

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
        platform: 'telegram',
        sender_id: senderId,
        sender_name: senderName,
        last_message_at: new Date().toISOString(),
        last_interaction: new Date().toISOString(),
        unread_count: 1,
        [channelField]: channelDbId,
      })
      .select()
      .maybeSingle();

    if (!newConv) {
      console.warn('Telegram: failed to create conversation', { senderId, platform: 'telegram' });
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

  // Update sender name if available
  if (senderName && (!conversation.sender_name || conversation.sender_name === senderId)) {
    await supabase.from('conversations').update({ sender_name: senderName }).eq('id', conversationId);
  }

  // Check if AI is paused
  if (conversation.is_ai_paused) {
    console.warn('Telegram: AI paused for conversation', { conversationId });
    return;
  }

  // Get AI settings (scoped to telegram bot)
  let { data: aiSettings } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', matchedBot.user_id)
    .eq('telegram_id', channelDbId)
    .maybeSingle();

  if (!aiSettings) {
    const { data: globalSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', matchedBot.user_id)
      .is('page_id', null)
      .is('instagram_id', null)
      .is('telegram_id', null)
      .maybeSingle();
    aiSettings = globalSettings;
  }

  // If still no AI settings, use defaults (like Meta webhook does)
  if (!aiSettings) {
    console.warn('Telegram: no AI settings found, using defaults');
    aiSettings = { ...DEFAULT_AI_SETTINGS, user_id: matchedBot.user_id };
  }

  if (!aiSettings.is_active) {
    console.warn('Telegram: AI settings inactive');
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

  // Handle AI response
  try {
    await handleAIResponse(
      matchedBot.user_id,
      matchedBot.user_id,
      channelDbId,
      null,
      null,
      conversationId,
      senderId,
      messageText,
      botToken,
      'telegram',
      aiSettings as AISettings
    );
  } catch (error) {
    console.error('Telegram AI handler error:', error);
    try {
      await sendTelegramMessage(botToken, chatId, "Sorry, I'm having trouble processing your request. Please try again later.");
    } catch {}
  }
}
