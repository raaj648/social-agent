import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { sendMessage, sendWhatsAppMessage, getMessengerUserProfile, getInstagramUserProfile, sendSenderAction, markWhatsAppMessageRead } from '@/lib/meta/graph';
import { createCompletion } from '@/lib/ai/openrouter';
import { buildSystemPrompt, buildConversationContext } from '@/lib/ai/prompts';
import { isWithinBusinessHours } from '@/lib/utils';
import type { AISettings } from '@/types';

interface WebhookPayload {
  platform: 'messenger' | 'instagram' | 'whatsapp';
  senderId: string;
  messageText: string;
  platformMsgId?: string;
  recipientId: string;
  timestamp: number;
  senderName?: string;
}

async function findChannel(supabase: any, platform: string, externalId: string) {
  if (platform === 'messenger') {
    const { data } = await supabase
      .from('connected_pages')
      .select('*, user:users!user_id(*)')
      .eq('page_id', externalId)
      .single();
    return data;
  }
  if (platform === 'instagram') {
    const { data } = await supabase
      .from('instagram_accounts')
      .select('*, user:users!user_id(*)')
      .eq('ig_account_id', externalId)
      .single();
    return data;
  }
  if (platform === 'whatsapp') {
    const { data } = await supabase
      .from('whatsapp_accounts')
      .select('*, user:users!user_id(*)')
      .eq('phone_number_id', externalId)
      .single();
    return data;
  }
  return null;
}

async function findOrCreateConversation(
  supabase: any,
  userId: string,
  platform: string,
  senderId: string,
  channelDbId: string,
  channelField: string
) {
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('sender_id', senderId)
    .eq('platform', platform)
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
    const insertData: Record<string, unknown> = {
      user_id: userId,
      platform,
      sender_id: senderId,
      sender_name: senderId,
      last_message_at: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
      unread_count: 1,
    };
    insertData[channelField] = channelDbId;

    const { data: newConv } = await supabase
      .from('conversations')
      .insert(insertData)
      .select()
      .single();

    if (!newConv) return null;
    conversation = newConv;
  }

  return conversation;
}

export async function processWebhookMessage(payload: WebhookPayload): Promise<void> {
  const supabase = await createAdminClient();
  const { platform, senderId, messageText, platformMsgId, recipientId, senderName } = payload;
  console.log(`[webhook] Received ${platform} message from ${senderId}: "${messageText?.substring(0, 100)}"`);

  const channelFieldMap: Record<string, string> = {
    messenger: 'page_id',
    instagram: 'instagram_id',
    whatsapp: 'whatsapp_id',
  };
  const channelField = channelFieldMap[platform];
  if (!channelField) return;

  const channel = await findChannel(supabase, platform, recipientId);
  if (!channel) {
    console.warn(`Channel ${platform}:${recipientId} not found`);
    return;
  }

  const user = channel.user as any;
  if (!user?.is_active) {
    console.warn(`User ${user?.id} is inactive`);
    return;
  }

  const conversation = await findOrCreateConversation(
    supabase,
    channel.user_id,
    platform,
    senderId,
    channel.id,
    channelField
  );
  if (!conversation) return;
  const conversationId = conversation.id;

  // Deduplication: skip if this platformMsgId has already been processed
  if (platformMsgId) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('platform_msg_id', platformMsgId)
      .maybeSingle();
    if (existingMsg) {
      console.log(`[webhook] Duplicate message ${platformMsgId} for conversation ${conversationId}, skipping`);
      return;
    }
  }

  // Always save incoming messages so users can see them even when AI is paused
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: messageText || '[attachment]',
    platform_msg_id: platformMsgId,
    sent_via_ai: false,
  });

  // Auto-resume check: if paused but auto_resume_at has passed, unpause
  if (conversation.is_ai_paused && conversation.auto_resume_at) {
    const resumeAt = new Date(conversation.auto_resume_at).getTime();
    if (Date.now() >= resumeAt) {
      await supabase.from('conversations').update({
        is_ai_paused: false,
        ai_enabled: true,
        auto_resume_at: null,
      }).eq('id', conversationId);
      conversation.is_ai_paused = false;
    }
  }

  // If AI is paused, stop here (message already saved above)
  if (conversation.is_ai_paused) return;

  // Fetch customer profile if conversation has no real name yet
  if (!conversation.sender_name || conversation.sender_name === senderId) {
    try {
      let profileName: string | null = null;
      let profilePic: string | null = null;
      if (platform === 'messenger') {
        const token = decrypt(channel.page_access_token);
        const profile = await getMessengerUserProfile(senderId, token);
        if (profile) {
          profileName = profile.name;
          profilePic = profile.picture_url;
        }
      } else if (platform === 'instagram') {
        const token = decrypt(channel.ig_access_token);
        const profile = await getInstagramUserProfile(senderId, token);
        if (profile) {
          profileName = profile.name;
          profilePic = profile.profile_pic_url;
        }
      } else if (platform === 'whatsapp') {
        if (senderName) {
          profileName = senderName;
        }
      }
      if (profileName || profilePic) {
        await supabase.from('conversations').update({
          ...(profileName ? { sender_name: profileName } : {}),
          ...(profilePic ? { sender_picture: profilePic } : {}),
        }).eq('id', conversationId);
        if (profileName) conversation.sender_name = profileName;
        if (profilePic) conversation.sender_picture = profilePic;
      }
    } catch {
      // Non-critical: profile fetch failure should not block message processing
    }
  }

  let aiSettings: AISettings | null = null;
  let accessToken = '';

  if (platform === 'messenger') {
    accessToken = decrypt(channel.page_access_token);
    let { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', channel.user_id)
      .eq('page_id', channel.id)
      .maybeSingle();
    if (!settings) {
      const { data: globalSettings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', channel.user_id)
        .is('page_id', null)
        .is('instagram_id', null)
        .maybeSingle();
      settings = globalSettings;
    }
    aiSettings = settings;
  } else if (platform === 'instagram') {
    accessToken = decrypt(channel.ig_access_token);
    let { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', channel.user_id)
      .eq('instagram_id', channel.id)
      .maybeSingle();
    if (!settings) {
      const { data: globalSettings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', channel.user_id)
        .is('page_id', null)
        .is('instagram_id', null)
        .maybeSingle();
      settings = globalSettings;
    }
    aiSettings = settings;
  } else if (platform === 'whatsapp') {
    accessToken = decrypt(channel.access_token);
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', channel.user_id)
      .is('page_id', null)
      .is('instagram_id', null)
      .maybeSingle();
    aiSettings = settings;
  }

  // Mark as seen / read immediately
  if (platformMsgId && accessToken) {
    if (platform === 'whatsapp') {
      const waChannel = channel as any;
      if (waChannel.phone_number_id) {
        markWhatsAppMessageRead(waChannel.phone_number_id, platformMsgId, accessToken)
          .catch(() => {});
      }
    } else if (platform === 'messenger' || platform === 'instagram') {
      sendSenderAction(senderId, accessToken, 'mark_seen', platform as 'messenger' | 'instagram')
        .catch(() => {});
    }
  }

  // If we have a business_id on the channel but not on aiSettings, try to get business-scoped settings
  if (channel.business_id && (!aiSettings?.business_id)) {
    const { data: bizSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('user_id', channel.user_id)
      .eq('business_id', channel.business_id)
      .maybeSingle();
    if (bizSettings) {
      aiSettings = bizSettings;
    }
  }

  if (!aiSettings) {
    aiSettings = {
      is_active: true,
      model: 'openai/gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500,
      fallback_response: "Thanks for your message! We'll get back to you shortly.",
      conversation_memory_count: 10,
      keywords_blacklist: [],
      business_hours_only: false,
      greeting_enabled: false,
      greeting_message: null,
      business_hours_start: null,
      business_hours_end: null,
      timezone: 'UTC',
      agent_display_name: 'Support Agent', ai_agent_name: 'AI Assistant',
      human_handoff_enabled: true, human_handoff_message: '{agent_name} has joined the chat',
      show_handoff_on_pause: false, auto_resume_minutes: null,
      business_name: null, agent_role: 'Sales Agent',
      id: '', user_id: '', business_id: null, page_id: null, instagram_id: null, telegram_id: null, discord_id: null, system_prompt: null,
    } as unknown as AISettings;
  } else if (!aiSettings.is_active) {
    return;
  }

  // Auto-detect business_name from the connected platform if not set yet
  if (!aiSettings.business_name) {
    let detectedName: string | null = null;
    if (platform === 'messenger') {
      detectedName = channel.page_name || null;
    } else if (platform === 'instagram') {
      detectedName = channel.ig_name || channel.ig_username || null;
    } else if (platform === 'whatsapp') {
      detectedName = channel.business_name || null;
    }
    if (detectedName) {
      await supabase.from('ai_settings').update({ business_name: detectedName }).eq('id', aiSettings.id);
      aiSettings.business_name = detectedName;
    }
  }

  const lowerMessage = messageText.toLowerCase();

  if (aiSettings.keywords_blacklist?.length > 0) {
    const blocked = aiSettings.keywords_blacklist.some(keyword =>
      keyword.trim() && lowerMessage.includes(keyword.trim().toLowerCase())
    );
    if (blocked) {
      await supabase.from('usage_logs').insert({
        user_id: channel.user_id,
        action: 'webhook_received',
        platform,
        metadata: { conversation_id: conversationId, reason: 'keyword_blacklist' },
      });
      return;
    }
  }

  if (aiSettings.business_hours_only && aiSettings.business_hours_start && aiSettings.business_hours_end) {
    const inHours = isWithinBusinessHours(
      aiSettings.business_hours_start,
      aiSettings.business_hours_end,
      aiSettings.timezone || 'UTC'
    );
    if (!inHours) {
      await supabase.from('usage_logs').insert({
        user_id: channel.user_id,
        action: 'webhook_received',
        platform,
        metadata: { conversation_id: conversationId, reason: 'outside_business_hours' },
      });
      return;
    }
  }

  if (aiSettings.greeting_enabled && aiSettings.greeting_message) {
    const { count: userMsgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('role', 'user');

    if (userMsgCount === 1) {
      const greeting = aiSettings.greeting_message;
      await sendPlatformReply(platform, senderId, greeting, accessToken, channel);
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: greeting,
        sent_via_ai: true,
      });
    }
  }

  // Atomic credit deduction
  const { data: deducted, error: deductError } = await supabase.rpc('deduct_credit', { p_user_id: channel.user_id });
  if (deductError) {
    console.error(`[webhook] deduct_credit RPC error for user ${channel.user_id}:`, deductError);
  }
  if (!deducted) {
    console.warn(`[webhook] Credit deduction failed for user ${channel.user_id} (deductError: ${deductError?.message || 'none'}). Sending fallback.`);
    const fallback = aiSettings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
    const sent = await sendPlatformReply(platform, senderId, fallback, accessToken, channel);
    if (!sent) console.error(`[webhook] Failed to send fallback reply to ${senderId} on ${platform}`);
    return;
  }
  console.log(`[webhook] Credit deducted for user ${channel.user_id}, proceeding to AI call`);

  // Fetch active AI provider (owner-configured) and master prompt / reasoning settings
  let providerConfig: { baseUrl: string; apiKey: string } | undefined;
  let activeModel = aiSettings.model || 'openai/gpt-4o-mini';
  let masterPrompt: string | null = null;
  let reasoningEnabled = true;
  let reasoningSuppressionPrompt = '';

  const [{ data: activeProvider }, { data: platformCfg }, { data: reasoningCfg }, { data: reasoningPromptCfg }] = await Promise.all([
    supabase.from('ai_providers').select('*').eq('is_active', true).order('sort_order').limit(1).maybeSingle(),
    supabase.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
    supabase.from('platform_settings').select('value').eq('key', 'reasoning_enabled').maybeSingle(),
    supabase.from('platform_settings').select('value').eq('key', 'reasoning_suppression_prompt').maybeSingle(),
  ]);

  if (activeProvider) {
    try {
      providerConfig = {
        baseUrl: activeProvider.base_url,
        apiKey: decrypt(activeProvider.api_key),
      };
      activeModel = activeProvider.default_model || activeModel;
    } catch {
      console.warn('Failed to decrypt provider API key, falling back to default');
    }
  }
  masterPrompt = platformCfg?.value as string || null;
  reasoningEnabled = reasoningCfg?.value === true || reasoningCfg?.value === 'true';
  reasoningSuppressionPrompt = (reasoningPromptCfg?.value as string) || '';

  // Fetch knowledge base using junction table
  const { data: kbLinks } = await supabase
    .from('knowledge_base_platforms')
    .select('kb_id')
    .eq('platform', platform)
    .or(`platform_ref_id.eq.${channel.id},platform_ref_id.is.null`);

  const kbIds = kbLinks?.map(r => r.kb_id) || [];
  const { data: knowledgeBase } = kbIds.length > 0
    ? await supabase
        .from('knowledge_base')
        .select('category, title, content')
        .eq('user_id', channel.user_id)
        .eq('is_active', true)
        .in('id', kbIds)
        .order('sort_order')
    : { data: [] };
  const filteredKB = knowledgeBase || [];

  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(aiSettings.conversation_memory_count || 10);

  const businessInfo = {
    name: user.business_name || user.full_name || 'Business',
    description: user.business_name || '',
  };

  let orderInstruction = '';
  if (user.order_method === 'website') {
    orderInstruction = `When the customer wants to place an order, say: 'Please complete your order here: ${user.order_link || 'our website'}'`;
  } else if (user.order_method === 'form') {
    orderInstruction = `When the customer wants to place an order, say: 'Please fill out this form: ${user.order_link || 'our order form'}'`;
  } else {
    orderInstruction = `When the customer wants to place an order, ask for their Name, Phone, Address, and Product details. Once they provide ALL four pieces of information, call the extract_order_details tool to save the order.`;
  }

  let systemPrompt = buildSystemPrompt(businessInfo, filteredKB, aiSettings, masterPrompt) + `\n\n## Order Collection\n${orderInstruction}`;
  if (!reasoningEnabled && reasoningSuppressionPrompt) {
    systemPrompt += `\n\n## Reasoning Suppression\n${reasoningSuppressionPrompt}`;
  }

  const conversationHistory = buildConversationContext(
    (recentMessages || []).reverse(),
    aiSettings.conversation_memory_count || 10
  );

  const baseTools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> = [];

  if (aiSettings.human_handoff_enabled) {
    baseTools.push({
      type: 'function',
      function: {
        name: 'request_human_support',
        description: 'Call this when the customer explicitly asks to speak to a real human agent. This transfers the conversation to a live support agent.',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });
  }

  if (user.order_method === 'direct_chat') {
    baseTools.push({
      type: 'function',
      function: {
        name: 'extract_order_details',
        description: 'Extract complete order details from the customer conversation',
        parameters: {
          type: 'object',
          properties: {
            customer_name: { type: 'string', description: 'Customer full name' },
            phone: { type: 'string', description: 'Customer phone number' },
            delivery_address: { type: 'string', description: 'Customer delivery address' },
            product_details: { type: 'string', description: 'Products ordered with quantities and details' },
          },
          required: ['customer_name', 'product_details'],
        },
      },
    });
  }

  // Add search_products tool (always available)
  baseTools.push({
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for products by name or keyword in the product catalog. Call this when a customer asks about specific products, prices, or availability.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The product search query (name or keyword)' },
        },
        required: ['query'],
      },
    },
  });

  const tools = baseTools.length > 0 ? baseTools : undefined;

  const model = activeModel;

  // Show typing indicator (Messenger/Instagram only) — right before AI call
  if ((platform === 'messenger' || platform === 'instagram') && accessToken) {
    sendSenderAction(senderId, accessToken, 'typing_on', platform as 'messenger' | 'instagram')
      .catch(() => {});
  }

  console.log(`[webhook] About to call AI for conversation ${conversationId}. Model: ${model}, Provider: ${providerConfig?.baseUrl || 'default'}, Message: "${messageText.substring(0, 50)}"`);

  try {
    const completionMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: messageText },
    ];

    const response = await createCompletion({
      model,
      messages: completionMessages,
      temperature: aiSettings.temperature || 0.7,
      max_tokens: aiSettings.max_tokens || 500,
      tools,
    }, providerConfig, !reasoningEnabled);

    const choice = response.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function.name === 'request_human_support') {
      const handoffMsg = "Connecting you to a human agent. Please wait...";
      await sendPlatformReply(platform, senderId, handoffMsg, accessToken, channel);
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: handoffMsg,
        sent_via_ai: true,
      });
      await supabase.from('conversations').update({
        is_urgent: true,
        requested_human_at: new Date().toISOString(),
        is_ai_paused: true,
      }).eq('id', conversationId);
      console.log(`[webhook] Human support requested for conversation ${conversationId}`);
      const tokensUsed = response.usage?.total_tokens || 0;
      await supabase.from('usage_logs').insert({
        user_id: channel.user_id,
        action: 'ai_reply',
        platform,
        tokens_used: tokensUsed,
        model_used: model,
        metadata: { conversation_id: conversationId, action: 'human_handoff' },
      });
      return;
    }

    if (toolCall && toolCall.function.name === 'extract_order_details') {
      const args = JSON.parse(toolCall.function.arguments);
      await supabase.from('orders').insert({
        user_id: channel.user_id,
        conversation_id: conversationId,
        customer_name: args.customer_name || null,
        phone: args.phone || null,
        delivery_address: args.delivery_address || null,
        product_details: args.product_details || '',
        status: 'pending',
        source: 'direct_chat',
      });

      const confirmationMsg = '\u2705 Order confirmed!\n\nName: ' + (args.customer_name || '\u2014') + '\nPhone: ' + (args.phone || '\u2014') + '\nAddress: ' + (args.delivery_address || '\u2014') + '\nProducts: ' + (args.product_details || '\u2014') + '\n\nWe will process your order shortly. Thank you!';
      await sendPlatformReply(platform, senderId, confirmationMsg, accessToken, channel);

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: confirmationMsg,
        sent_via_ai: true,
      });
    } else if (toolCall && toolCall.function.name === 'search_products') {
      const args = JSON.parse(toolCall.function.arguments);
      const searchQuery = (args.query || '').replace(/'/g, "''");

      let searchReq = supabase
        .from('products')
        .select('name, description, price, category, image_url')
        .eq('user_id', channel.user_id)
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

      if (channel.business_id) {
        searchReq = searchReq.eq('business_id', channel.business_id);
      }
      if (channel.id) {
        searchReq = searchReq.or(`platform_ref_id.eq.${channel.id},platform_ref_id.is.null`);
      }

      const { data: products } = await searchReq.limit(10);

      const productList = products && products.length > 0
        ? products.map((p: any) =>
            `- ${p.name}${p.price ? ' ($' + p.price + ')' : ''}${p.description ? ': ' + p.description : ''}`
          ).join('\n')
        : 'No products found for "' + searchQuery + '".';

      const toolResult = '## Product Search Results for "' + searchQuery + '"\n' + productList;

      const followUpMessages = [
        ...completionMessages,
        { role: 'assistant', content: null, tool_calls: [toolCall] },
        { role: 'tool', tool_call_id: toolCall.id, content: toolResult },
      ];

      const followUp = await createCompletion({
        model,
        messages: followUpMessages,
        temperature: aiSettings.temperature || 0.7,
        max_tokens: aiSettings.max_tokens || 500,
      }, providerConfig);

      const followUpContent = followUp.choices?.[0]?.message?.content;
      if (followUpContent) {
        const sent = await sendPlatformReply(platform, senderId, followUpContent, accessToken, channel);
        if (sent) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: followUpContent,
            sent_via_ai: true,
          });
        }
      }
    } else {
      const aiReply = choice?.message?.content;
      if (!aiReply) {
        console.warn(`[webhook] AI returned empty reply for conversation ${conversationId}, sending fallback`);
        const fallback = aiSettings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
        const sent = await sendPlatformReply(platform, senderId, fallback, accessToken, channel);
        if (!sent) console.error(`[webhook] Failed to send fallback (empty reply) to ${senderId}`);
        return;
      }

      const sent = await sendPlatformReply(platform, senderId, aiReply, accessToken, channel);
      if (sent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiReply,
          sent_via_ai: true,
        });
      } else {
        console.error(`[webhook] sendPlatformReply returned false for conversation ${conversationId} to ${senderId}`);
      }
    }

    const tokensUsed = response.usage?.total_tokens || 0;

    await supabase.from('usage_logs').insert({
      user_id: channel.user_id,
      action: 'ai_reply',
      platform,
      tokens_used: tokensUsed,
      model_used: model,
      metadata: { conversation_id: conversationId, message_length: messageText.length },
    });

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

  } catch (error) {
    console.error(`[webhook] AI processing error for conversation ${conversationId}:`, error);
    // Stop typing indicator on error (Messenger/Instagram only)
    if ((platform === 'messenger' || platform === 'instagram') && accessToken) {
      sendSenderAction(senderId, accessToken, 'typing_off', platform as 'messenger' | 'instagram')
        .catch(() => {});
    }
    const fallback = aiSettings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
    const sent = await sendPlatformReply(platform, senderId, fallback, accessToken, channel);
    if (!sent) console.error(`[webhook] Also failed to send fallback reply to ${senderId} after AI error`);
  }
}

async function sendPlatformReply(
  platform: string,
  recipientId: string,
  text: string,
  accessToken: string,
  channel: any
): Promise<boolean> {
  if (platform === 'messenger') {
    return sendMessage(recipientId, text, accessToken, 'messenger');
  }
  if (platform === 'instagram') {
    return sendMessage(recipientId, text, accessToken, 'instagram');
  }
  if (platform === 'whatsapp') {
    return sendWhatsAppMessage(channel.phone_number_id, recipientId, text, accessToken);
  }
  return false;
}
