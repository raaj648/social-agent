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

export async function processTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (!update.message?.text || !update.message?.chat) return;

  const supabase = await createAdminClient();
  const chatId = String(update.message.chat.id);
  const messageText = update.message.text;
  const senderId = String(update.message.from?.id || chatId);
  const senderName = update.message.from?.first_name
    ? [update.message.from.first_name, update.message.from.last_name].filter(Boolean).join(' ')
    : update.message.chat.title || senderId;

  // Find bot by chat context - look up all telegram bots and check if any match
  // For group chats, we match differently than DMs
  const { data: bots } = await supabase.from('telegram_bots').select('*, user:users!user_id(*)');

  if (!bots || bots.length === 0) return;

  // Find the correct bot: in DM the bot gets messages directly, in groups we check
  let matchedBot: any = null;

  if (update.message.chat.type === 'private') {
    // Direct message - try all bots (only the correct one will receive this)
    matchedBot = bots[0];
  } else {
    // Group/supergroup message - check if bot is mentioned
    const botUsernames = bots.map((b: any) => b.bot_username).filter(Boolean);
    const mentioned = botUsernames.some((u: string) =>
      messageText.toLowerCase().includes(`@${u.toLowerCase()}`)
    );
    if (!mentioned) return;
    matchedBot = bots.find((b: any) =>
      messageText.toLowerCase().includes(`@${(b.bot_username || '').toLowerCase()}`)
    ) || bots[0];
  }

  if (!matchedBot) return;

  const user = matchedBot.user as any;
  if (!user?.is_active) return;

  const botToken = decrypt(matchedBot.bot_token);
  const channelField = 'telegram_id';
  const channelDbId = matchedBot.id;

  // Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', matchedBot.user_id)
    .eq('sender_id', senderId)
    .eq('platform', 'telegram')
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
        platform: 'telegram',
        sender_id: senderId,
        sender_name: senderName,
        last_message_at: new Date().toISOString(),
        last_interaction: new Date().toISOString(),
        unread_count: 1,
        [channelField]: channelDbId,
      })
      .select()
      .single();

    if (!newConv) return;
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
  if (conversation.is_ai_paused) return;

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

  if (!aiSettings?.is_active) return;

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
  await handleAIResponse(
    matchedBot.user_id,
    matchedBot.user_id,
    null,
    null,
    null,
    conversationId,
    senderId,
    messageText,
    botToken,
    'telegram',
    aiSettings as AISettings
  );
}
