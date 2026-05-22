import { createAdminClient } from '@/lib/supabase/admin';
import { sendMessage, sendInstagramMessage, sendWhatsAppMessage } from '@/lib/meta/graph';
import { createCompletion, createFallbackResponse } from '@/lib/ai/openrouter';
import { buildSystemPrompt, buildConversationContext } from '@/lib/ai/prompts';
import { isWithinBusinessHours } from '@/lib/utils';
import { decrypt } from '@/lib/crypto';
import type { AISettings } from '@/types';

export async function handleAIResponse(
  targetUserId: string,
  loggedInUserId: string,
  pageDbId: string | null,
  instagramDbId: string | null,
  whatsappDbId: string | null,
  conversationId: string,
  senderId: string,
  incomingMessage: string,
  accessToken: string,
  platform: 'messenger' | 'instagram' | 'whatsapp',
  aiSettings: AISettings
): Promise<void> {
  try {
    const supabase = await createAdminClient();

    // Fetch AI settings if not provided
    let settings = aiSettings;
    if (!aiSettings) {
      const { data: settingsData } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', targetUserId)
        .is('page_id', null)
        .is('instagram_id', null)
        .single();
      settings = settingsData;
    }

    if (!settings?.is_active) return;

    // Blacklist check
    const lowerMessage = incomingMessage.toLowerCase();
    if (settings.keywords_blacklist?.length > 0) {
      const blocked = settings.keywords_blacklist.some(keyword =>
        keyword.trim() && lowerMessage.includes(keyword.trim().toLowerCase())
      );
      if (blocked) {
        await supabase.from('usage_logs').insert({
          user_id: targetUserId,
          action: 'webhook_received',
          platform,
          metadata: { conversation_id: conversationId, reason: 'keyword_blacklist' },
        });
        return;
      }
    }

    // Business hours check
    if (settings.business_hours_only && settings.business_hours_start && settings.business_hours_end) {
      const inHours = isWithinBusinessHours(
        settings.business_hours_start,
        settings.business_hours_end,
        settings.timezone || 'UTC'
      );
      if (!inHours) {
        await supabase.from('usage_logs').insert({
          user_id: targetUserId,
          action: 'webhook_received',
          platform,
          metadata: { conversation_id: conversationId, reason: 'outside_business_hours' },
        });
        return;
      }
    }

    // Greeting message
    if (settings.greeting_enabled && settings.greeting_message) {
      const { count: userMsgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('role', 'user');

      if (userMsgCount === 1) {
        const greeting = settings.greeting_message;
        const sent = await sendPlatformMessage(senderId, greeting, accessToken, platform, instagramDbId, whatsappDbId, settings);
        if (sent) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: greeting,
            sent_via_ai: true,
          });
        }
      }
    }

    // Atomic credit deduction
    const { data: deducted } = await supabase.rpc('deduct_credit', { p_user_id: targetUserId });
    if (!deducted) {
      const fallback = settings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
      await sendPlatformMessage(senderId, fallback, accessToken, platform, instagramDbId, whatsappDbId, settings);
      return;
    }

    // Fetch active AI provider and master prompt
    let providerConfig: { baseUrl: string; apiKey: string } | undefined;
    let activeModel = settings.model || 'openai/gpt-4o-mini';
    let masterPrompt: string | null = null;

    const [{ data: activeProvider }, { data: platformCfg }] = await Promise.all([
      supabase.from('ai_providers').select('*').eq('is_active', true).order('sort_order').limit(1).single(),
      supabase.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
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

    // Look up business_id from platform account for multi-business scoping
    let businessId: string | null = null;
    if (settings?.business_id) {
      businessId = settings.business_id;
    } else if (pageDbId) {
      const { data: page } = await supabase.from('connected_pages').select('business_id').eq('id', pageDbId).single();
      businessId = page?.business_id || null;
    } else if (instagramDbId) {
      const { data: ig } = await supabase.from('instagram_accounts').select('business_id').eq('id', instagramDbId).single();
      businessId = ig?.business_id || null;
    } else if (whatsappDbId) {
      const { data: wa } = await supabase.from('whatsapp_accounts').select('business_id').eq('id', whatsappDbId).single();
      businessId = wa?.business_id || null;
    }

    // If we found a business_id, refetch ai_settings scoped to it
    if (businessId && (!settings?.business_id)) {
      const { data: bizSettings } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('business_id', businessId)
        .maybeSingle();
      if (bizSettings) {
        settings = { ...settings, ...bizSettings } as AISettings;
      }
    }

    // Fetch knowledge base using junction table
    const channelRefId = pageDbId || instagramDbId || whatsappDbId;
    const { data: kbLinks } = await supabase
      .from('knowledge_base_platforms')
      .select('kb_id')
      .eq('platform', platform)
      .or(`platform_ref_id.eq.${channelRefId},platform_ref_id.is.null`);

    const kbIds = kbLinks?.map(r => r.kb_id) || [];
    const { data: knowledgeBase } = kbIds.length > 0
      ? await supabase
          .from('knowledge_base')
          .select('category, title, content')
          .eq('user_id', targetUserId)
          .eq('is_active', true)
          .in('id', kbIds)
          .order('sort_order')
      : { data: [] };
    const filteredKB = knowledgeBase || [];

    // Fetch recent messages
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(settings.conversation_memory_count || 10);

    // Business info
    const { data: userData } = await supabase
      .from('users')
      .select('business_name, full_name, order_method, order_link')
      .eq('id', targetUserId)
      .single();

    const businessInfo = {
      name: userData?.business_name || userData?.full_name || 'Business',
      description: userData?.business_name || '',
    };

    // Order instruction
    let orderInstruction = '';
    if (userData?.order_method === 'website') {
      orderInstruction = `When the customer wants to place an order, say: 'Please complete your order here: ${userData?.order_link || 'our website'}'`;
    } else if (userData?.order_method === 'form') {
      orderInstruction = `When the customer wants to place an order, say: 'Please fill out this form: ${userData?.order_link || 'our order form'}'`;
    } else {
      orderInstruction = `When the customer wants to place an order, ask for their Name, Phone, Address, and Product details. Once they provide ALL four pieces of information, call the extract_order_details tool to save the order.`;
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(businessInfo, filteredKB, settings, masterPrompt) + `\n\n## Order Collection\n${orderInstruction}`;

    // Build conversation history
    const conversationHistory = buildConversationContext(
      (recentMessages || []).reverse(),
      settings.conversation_memory_count || 10
    );

    // Prepare completion messages
    const completionMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: incomingMessage },
    ];

    // Prepare tools
    const baseTools: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }> = [];

    if (settings.human_handoff_enabled) {
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

    if (userData?.order_method === 'direct_chat') {
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

    // Create completion
    const response = await createCompletion({
      model: activeModel,
      messages: completionMessages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 500,
      tools,
    }, providerConfig);

    const choice = response.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function.name === 'request_human_support') {
      const handoffMsg = "Connecting you to a human agent. Please wait...";
      const sent = await sendPlatformMessage(senderId, handoffMsg, accessToken, platform, instagramDbId, whatsappDbId, settings);
      if (sent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: handoffMsg,
          sent_via_ai: true,
        });
      }
      await supabase.from('conversations').update({
        is_urgent: true,
        requested_human_at: new Date().toISOString(),
        is_ai_paused: true,
      }).eq('id', conversationId);
    } else if (toolCall && toolCall.function.name === 'extract_order_details') {
      const args = JSON.parse(toolCall.function.arguments);
      await supabase.from('orders').insert({
        user_id: targetUserId,
        conversation_id: conversationId,
        customer_name: args.customer_name || null,
        phone: args.phone || null,
        delivery_address: args.delivery_address || null,
        product_details: args.product_details || '',
        status: 'pending',
        source: 'direct_chat',
      });

      const confirmationMsg = '\u2705 Order confirmed!\n\nName: ' + (args.customer_name || '\u2014') + '\nPhone: ' + (args.phone || '\u2014') + '\nAddress: ' + (args.delivery_address || '\u2014') + '\nProducts: ' + (args.product_details || '\u2014') + '\n\nWe will process your order shortly. Thank you!';
      const sent = await sendPlatformMessage(senderId, confirmationMsg, accessToken, platform, instagramDbId, whatsappDbId, settings);
      if (sent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: confirmationMsg,
          sent_via_ai: true,
        });
      }
    } else if (toolCall && toolCall.function.name === 'search_products') {
      const args = JSON.parse(toolCall.function.arguments);
      const searchQuery = (args.query || '').replace(/'/g, "''");
      const channelRefId = pageDbId || instagramDbId || whatsappDbId;

      let searchReq = supabase
        .from('products')
        .select('name, description, price, category, image_url')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);

      if (businessId) {
        searchReq = searchReq.eq('business_id', businessId);
      }
      if (channelRefId) {
        searchReq = searchReq.eq('platform_ref_id', channelRefId);
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
        { role: 'assistant' as const, content: null, tool_calls: [toolCall] },
        { role: 'tool' as const, tool_call_id: toolCall.id, content: toolResult },
      ];

      const followUp = await createCompletion({
        model: activeModel,
        messages: followUpMessages,
        temperature: settings.temperature || 0.7,
        max_tokens: settings.max_tokens || 500,
      }, providerConfig);

      const followUpContent = followUp.choices?.[0]?.message?.content;
      if (followUpContent) {
        const sent = await sendPlatformMessage(senderId, followUpContent, accessToken, platform, instagramDbId, whatsappDbId, settings);
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
        const fallback = settings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
        await sendPlatformMessage(senderId, fallback, accessToken, platform, instagramDbId, whatsappDbId, settings);
        return;
      }

      const sent = await sendPlatformMessage(senderId, aiReply, accessToken, platform, instagramDbId, whatsappDbId, settings);
      if (sent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiReply,
          sent_via_ai: true,
        });
      }
    }

    // Update conversation timestamp and log usage
    const tokensUsed = response.usage?.total_tokens || 0;
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    await supabase.from('usage_logs').insert({
      user_id: targetUserId,
      page_id: pageDbId,
      action: 'ai_reply',
      platform,
      tokens_used: tokensUsed,
      model_used: activeModel,
      metadata: { conversation_id: conversationId, message_length: incomingMessage.length },
    });
  } catch (error) {
    console.error('AI handler error:', error);

    try {
      const fallback = aiSettings.fallback_response || "Thanks for your message! We'll get back to you shortly.";
      await sendPlatformMessage(senderId, fallback, accessToken, platform, instagramDbId, whatsappDbId, aiSettings);
    } catch (sendError) {
      console.error('Failed to send fallback message:', sendError);
    }
  }
}

async function sendPlatformMessage(
  recipientId: string,
  text: string,
  accessToken: string,
  platform: 'messenger' | 'instagram' | 'whatsapp',
  instagramDbId: string | null,
  whatsappDbId: string | null,
  aiSettings: AISettings
): Promise<boolean> {
  if (platform === 'instagram') {
    const supabase = await createAdminClient();
    const { data: igAccount } = await supabase
      .from('instagram_accounts')
      .select('ig_account_id')
      .eq('id', instagramDbId)
      .single();

    if (!igAccount) return false;
    return sendInstagramMessage(igAccount.ig_account_id, recipientId, text, accessToken);
  }

  if (platform === 'whatsapp') {
    const supabase = await createAdminClient();
    const { data: waAccount } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id')
      .eq('id', whatsappDbId)
      .single();

    if (!waAccount) return false;
    return sendWhatsAppMessage(waAccount.phone_number_id, recipientId, text, accessToken);
  }

  return sendMessage(recipientId, text, accessToken, 'messenger');
}
