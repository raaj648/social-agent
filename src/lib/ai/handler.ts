import { createAdminClient } from '@/lib/supabase/admin';
import { sendMessage, sendWhatsAppMessage } from '@/lib/meta/graph';
import { sendTelegramMessage } from '@/lib/telegram/bot';
import { sendDiscordMessage } from '@/lib/discord/bot';
import { createCompletion, createFallbackResponse, type ProviderConfig } from '@/lib/ai/openrouter';
import { buildSystemPrompt, buildConversationContext } from '@/lib/ai/prompts';
import { isWithinBusinessHours } from '@/lib/utils';
import { decrypt } from '@/lib/crypto';
import { resolveMediaProviders } from '@/lib/ai/router';
import { transcribeVoice } from '@/lib/media/transcribe';
import { resizeImage } from '@/lib/media/resize';
import { detectProviderType, type ProviderType } from '@/lib/ai/provider';
import { executeWithFallback, AllRetriesFailedError } from '@/lib/ai/retry';
import { getModelPrice, calculateCost } from '@/lib/ai/pricing';
import type { RetryableProvider, TokenUsage, ActionType } from '@/lib/ai/types';
import type { AISettings } from '@/types';
import type { MediaBundle } from '@/lib/media/types';
import type { ContentPart } from '@/lib/ai/openrouter';

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
  platform: 'messenger' | 'instagram' | 'whatsapp' | 'telegram' | 'discord',
  aiSettings: AISettings,
  mediaBundle?: MediaBundle,
  interactionAppId?: string,
  interactionToken?: string,
  webhookName?: string
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
        const sent = await sendPlatformMessage(senderId, greeting, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, undefined, webhookName);
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

    // Quick credit check (actual deduct_points happens later with calculated cost)
    const { data: userCredits } = await supabase
      .from('users')
      .select('credits_remaining')
      .eq('id', targetUserId)
      .single();
    if (!userCredits || userCredits.credits_remaining <= 0) {
      console.warn(`[handler] User ${targetUserId} has no credits remaining`);
      if (settings.fallback_response) {
        await sendPlatformMessage(senderId, settings.fallback_response, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, undefined, webhookName);
      }
      return;
    }

    // Fetch ALL active AI providers + settings
    const [{ data: allProviders }, { data: platformCfg }, { data: reasoningCfg }, { data: memoryCountCfg }, { data: tempCfg }, { data: tokensCfg }, { data: mediaImageModelCfg }, { data: mediaImageProviderTypeCfg }, { data: mediaImageProviderIdCfg }, { data: mediaImageEnabledCfg }, { data: mediaImageMaxSizeCfg }, { data: mediaImageMaxCountCfg }, { data: mediaVoiceEnabledCfg }, { data: mediaVoiceProviderIdCfg }, { data: mediaVoiceModelCfg }, { data: pointCostTextCfg }, { data: pointCostImageCfg }, { data: pointCostVoiceCfg }] = await Promise.all([
      supabase.from('ai_providers').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'reasoning_enabled').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'default_conversation_memory_count').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'default_temperature').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'default_max_tokens').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_model').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_provider_type').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_provider_id').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_enabled').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_max_size').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_image_max_count').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_voice_enabled').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_voice_provider_id').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'media_voice_model').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_text_reply').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_image_read').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'point_cost_voice_read').maybeSingle(),
    ]);
    const defaultMemoryCount = memoryCountCfg?.value ? Number(memoryCountCfg.value) : 10;
    const defaultTemperature = tempCfg?.value ? Number(tempCfg.value) : 0.7;
    const defaultMaxTokens = tokensCfg?.value ? Number(tokensCfg.value) : 500;

    const mediaImageMaxCount = Number(mediaImageMaxCountCfg?.value) || 3;
    const mediaSettings: Record<string, unknown> = {
      media_image_model: mediaImageModelCfg?.value || 'openai/gpt-4o-mini',
      media_image_provider_type: mediaImageProviderTypeCfg?.value || 'openrouter',
      media_image_provider_id: mediaImageProviderIdCfg?.value || '',
      media_image_enabled: mediaImageEnabledCfg?.value ?? true,
      media_image_max_size: mediaImageMaxSizeCfg?.value || 2048,
      media_image_max_count: mediaImageMaxCount,
      media_voice_enabled: mediaVoiceEnabledCfg?.value ?? true,
      media_voice_provider_id: mediaVoiceProviderIdCfg?.value || '',
      media_voice_model: mediaVoiceModelCfg?.value || 'openai/whisper-large-v3-turbo',
    };

    const pointCosts = {
      text_reply: Number(pointCostTextCfg?.value) || 1,
      image_read: Number(pointCostImageCfg?.value) || 3,
      voice_read: Number(pointCostVoiceCfg?.value) || 2,
    };

    // Build provider groups by role
    let providerConfig: ProviderConfig | undefined;
    let activeModel = settings.model || 'openai/gpt-4o-mini';
    let masterPrompt: string | null = null;
    let reasoningEnabled = true;
    let reasoningMaxTokens: number | undefined;
    let reasoningStrategy: string | undefined;
    let reasoningMediaMaxTokens: number | undefined;

    const textProviders: RetryableProvider[] = [];
    const visionProviders: RetryableProvider[] = [];
    const voiceProviders: RetryableProvider[] = [];
    const dbPricingMap = new Map<string, { input: number; output: number }>();

    if (allProviders && allProviders.length > 0) {
      for (const p of allProviders) {
        try {
          const decryptedKey = decrypt(p.api_key);
          const roles: Array<'text' | 'vision' | 'voice'> = p.roles || ['text'];
          const retryable: RetryableProvider = {
            id: p.id,
            config: { baseUrl: p.base_url, apiKey: decryptedKey, providerType: p.provider_type as ProviderType },
            model: p.default_model || 'openai/gpt-4o-mini',
            roles,
          };
          if (roles.includes('text')) textProviders.push(retryable);
          if (roles.includes('vision')) visionProviders.push(retryable);
          if (roles.includes('voice')) voiceProviders.push(retryable);
          if (!providerConfig) {
            providerConfig = retryable.config as ProviderConfig;
            activeModel = p.default_model || activeModel;
            reasoningMaxTokens = p.reasoning_max_tokens ?? undefined;
            reasoningStrategy = p.reasoning_strategy || undefined;
            reasoningMediaMaxTokens = p.reasoning_media_max_tokens ?? undefined;
          }
        } catch {
          console.warn(`Failed to decrypt provider ${p.id} API key, skipping`);
        }
      }

      // Load pricing map from DB
      const { data: pricingRows } = await supabase.from('model_pricing').select('*');
      if (pricingRows) {
        for (const pr of pricingRows) {
          dbPricingMap.set(`${pr.provider_id}:${pr.model_name}`, {
            input: Number(pr.input_price_per_1m_tokens) || 0,
            output: Number(pr.output_price_per_1m_tokens) || 0,
          });
        }
      }
    }
    masterPrompt = platformCfg?.value as string || null;
    reasoningEnabled = reasoningCfg?.value === true || reasoningCfg?.value === 'true';

    // Look up business_id from platform account for multi-business scoping
    let businessId: string | null = null;
    if (settings?.business_id) {
      businessId = settings.business_id;
    } else if (platform === 'telegram' && pageDbId) {
      const { data: tg } = await supabase.from('telegram_bots').select('business_id').eq('id', pageDbId).maybeSingle();
      businessId = tg?.business_id || null;
    } else if (platform === 'discord' && pageDbId) {
      const { data: dc } = await supabase.from('discord_bots').select('business_id').eq('id', pageDbId).maybeSingle();
      businessId = dc?.business_id || null;
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
      .limit(settings.conversation_memory_count ?? defaultMemoryCount);

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
    let systemPrompt = buildSystemPrompt(businessInfo, filteredKB, settings, masterPrompt) + `\n\n## Order Collection\n${orderInstruction}`;

    // Build conversation history
    const conversationHistory = buildConversationContext(
      (recentMessages || []).reverse(),
      settings.conversation_memory_count ?? defaultMemoryCount
    );

    // Prepare completion messages (with optional image content)
    const hasMedia = !!(mediaBundle && (mediaBundle.images.length > 0 || mediaBundle.voice));
    let userContent: string | ContentPart[] = incomingMessage;

    if (mediaBundle?.images && mediaBundle.images.length > 0 && visionProviders.length > 0) {
      const parts: ContentPart[] = [
        { type: 'text' as const, text: incomingMessage },
      ];
      const maxSize = Number(mediaSettings.media_image_max_size) || 2048;
      for (const img of mediaBundle.images.slice(0, mediaImageMaxCount)) {
        try {
          const resized = await resizeImage(img.data, img.mimeType, maxSize);
          const base64 = resized.data.toString('base64');
          parts.push({ type: 'image_url' as const, image_url: { url: `data:${resized.mimeType};base64,${base64}` } });
        } catch {
          const base64 = img.data.toString('base64');
          parts.push({ type: 'image_url' as const, image_url: { url: `data:${img.mimeType};base64,${base64}` } });
        }
      }
      userContent = parts;
    }

    // Transcribe voice if present (use voice provider if available, else text provider)
    const primaryVoiceProvider = voiceProviders[0] || textProviders[0];
    if (mediaBundle?.voice && !mediaBundle.transcript && primaryVoiceProvider) {
      try {
        const transcript = await transcribeVoice(mediaBundle.voice, {
          apiKey: primaryVoiceProvider.config.apiKey,
          model: String(mediaSettings.media_voice_model || 'openai/whisper-large-v3-turbo'),
          baseUrl: primaryVoiceProvider.config.baseUrl || undefined,
          providerType: primaryVoiceProvider.config.providerType,
        });
        if (transcript) {
          mediaBundle.transcript = transcript;
          const transcriptText = `[Transcribed voice: "${transcript}"]`;
          userContent = typeof userContent === 'string'
            ? `${userContent}\n\n${transcriptText}`
            : [...userContent, { type: 'text' as const, text: transcriptText }];
        }
      } catch (err) {
        console.error('Voice transcription failed:', err);
      }
    }

    const completionMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: userContent },
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

    // Override reasoning when media is present (auto-enable for image/voice messages)
    const effectiveSuppressReasoning = (hasMedia && reasoningMediaMaxTokens) ? false : !reasoningEnabled;
    const effectiveReasoningMaxTokens = (hasMedia && reasoningMediaMaxTokens) ? reasoningMediaMaxTokens : reasoningMaxTokens;

    // Resolve vision/voice providers via router
    const mediaRouterResult = resolveMediaProviders({
      hasImage: !!(mediaBundle?.images?.length),
      hasVoice: !!(mediaBundle?.voice),
      mediaSettings,
      providers: [...textProviders, ...visionProviders, ...voiceProviders],
    });

    let resolvedModel = activeModel;
    let textProviderGroup = textProviders;
    if (mediaBundle?.images && mediaBundle.images.length > 0 && mediaRouterResult.visionProvider) {
      resolvedModel = mediaRouterResult.visionModel;
      textProviderGroup = [mediaRouterResult.visionProvider, ...textProviders];
    }

    // Calculate point cost and deduct before AI call
    const actionType: ActionType = mediaBundle?.images?.length ? 'image_read' : mediaBundle?.voice ? 'voice_read' : 'text_reply';
    const pointCost = actionType === 'text_reply' ? pointCosts.text_reply : actionType === 'image_read' ? pointCosts.image_read : pointCosts.voice_read;
    const { data: deducted, error: deductError } = await supabase.rpc('deduct_points', {
      p_user_id: targetUserId,
      p_amount: pointCost,
    });
    if (deductError) {
      console.error('Points deduction error:', deductError);
    } else if (deducted === false) {
      console.warn(`[handler] User ${targetUserId} has insufficient points (needed ${pointCost})`);
      if (settings.fallback_response) {
        await sendPlatformMessage(senderId, settings.fallback_response, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, undefined, webhookName);
      }
      return;
    }

    // Fire-and-forget: update subscription points_used
    if (deducted === true) {
      supabase.rpc('update_subscription_points_used', {
        p_user_id: targetUserId,
        p_amount: pointCost,
      }).then(() => {}, () => {});
    }

    // Create completion with retry + fallback
    const primaryProviders = mediaBundle?.images?.length ? (mediaRouterResult.visionProvider ? [mediaRouterResult.visionProvider, ...textProviders] : textProviders) : textProviders;
    let response: Awaited<ReturnType<typeof createCompletion>>;
    let textProviderUsed: RetryableProvider;

    try {
      const result = await executeWithFallback(primaryProviders, (provider) =>
        createCompletion({
          model: provider.model,
          messages: completionMessages,
          temperature: settings.temperature ?? defaultTemperature,
          max_tokens: settings.max_tokens ?? defaultMaxTokens,
          tools,
        }, provider.config as ProviderConfig, effectiveSuppressReasoning, effectiveReasoningMaxTokens, reasoningStrategy),
        { maxAttempts: 3 }
      );
      response = result.result;
      textProviderUsed = result.providerUsed;
    } catch (err) {
      const retryErr = err instanceof AllRetriesFailedError ? err : new AllRetriesFailedError(
        [err instanceof Error ? err : new Error(String(err))],
        ['unknown']
      );
      console.error(`[handler] All AI retry attempts failed for conversation ${conversationId}:`, retryErr.errors);
      return;
    }

    const choice = response.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall && toolCall.function.name === 'request_human_support') {
      const handoffMsg = "Connecting you to a human agent. Please wait...";
      const sent = await sendPlatformMessage(senderId, handoffMsg, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, undefined, webhookName);
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
      const sent = await sendPlatformMessage(senderId, confirmationMsg, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, undefined, webhookName);
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

      let followUp: Awaited<ReturnType<typeof createCompletion>>;
      try {
        const result = await executeWithFallback(
          textProviders.length > 0 ? textProviders : primaryProviders,
          (provider) => createCompletion({
            model: provider.model,
            messages: followUpMessages,
            temperature: settings.temperature ?? defaultTemperature,
            max_tokens: settings.max_tokens ?? defaultMaxTokens,
          }, provider.config as ProviderConfig, effectiveSuppressReasoning, effectiveReasoningMaxTokens, reasoningStrategy),
          { maxAttempts: 3 }
        );
        followUp = result.result;
      } catch {
        console.error(`[handler] Follow-up AI call failed for conversation ${conversationId}`);
        return;
      }

      const followUpContent = followUp.choices?.[0]?.message?.content;
      if (followUpContent) {
        const sent = await sendPlatformMessage(senderId, followUpContent, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, incomingMessage, webhookName);
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
        console.warn(`[handler] AI returned empty reply for conversation ${conversationId}`);
        return;
      }

      const sent = await sendPlatformMessage(senderId, aiReply, accessToken, platform, instagramDbId, whatsappDbId, settings, pageDbId, interactionAppId, interactionToken, incomingMessage, webhookName);
      if (sent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiReply,
          sent_via_ai: true,
        });
      }
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Calculate cost and log usage
    const tokenUsage: TokenUsage = {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || (response.usage?.total_tokens || 0) - (response.usage?.prompt_tokens || 0),
      reasoning_tokens: (response.usage as any)?.completion_tokens_details?.reasoning_tokens || 0,
    };
    const pricing = getModelPrice(resolvedModel, textProviderUsed?.id || '', dbPricingMap);
    const cost = calculateCost(tokenUsage, pricing);

    await supabase.from('usage_logs').insert({
      user_id: targetUserId,
      page_id: pageDbId,
      action: 'ai_reply',
      action_type: actionType,
      platform,
      tokens_used: tokenUsage.input_tokens + tokenUsage.output_tokens,
      model_used: resolvedModel,
      provider_id: textProviderUsed?.id || null,
      model_name: resolvedModel,
      input_tokens: tokenUsage.input_tokens,
      output_tokens: tokenUsage.output_tokens,
      reasoning_tokens: tokenUsage.reasoning_tokens,
      input_cost: cost.input_cost,
      output_cost: cost.output_cost,
      total_cost: cost.total_cost,
      points_charged: pointCost,
      metadata: {
        conversation_id: conversationId,
        message_length: incomingMessage.length,
        has_image: !!(mediaBundle?.images?.length),
        has_voice: !!(mediaBundle?.voice),
      },
    });
  } catch (error) {
    console.error('AI handler error:', error);
  }
}

async function sendPlatformMessage(
  recipientId: string,
  text: string,
  accessToken: string,
  platform: 'messenger' | 'instagram' | 'whatsapp' | 'telegram' | 'discord',
  instagramDbId: string | null,
  whatsappDbId: string | null,
  aiSettings: AISettings,
  pageDbId?: string | null,
  interactionAppId?: string,
  interactionToken?: string,
  userMessage?: string,
  webhookName?: string,
): Promise<boolean> {
  if (platform === 'instagram') {
    const supabase = await createAdminClient();
    const { data: igAccount } = await supabase
      .from('instagram_accounts')
      .select('ig_account_id')
      .eq('id', instagramDbId)
      .single();

    if (!igAccount) return false;
    return sendMessage(recipientId, text, accessToken, 'instagram');
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

  if (platform === 'telegram') {
    return sendTelegramMessage(accessToken, recipientId, text);
  }

  if (platform === 'discord') {
    const channelId = pageDbId || recipientId;
    const discordText = userMessage ? `> ${userMessage}\n\n${text}` : text;
    return sendDiscordMessage(accessToken, channelId, discordText, interactionAppId, interactionToken, webhookName);
  }

  return sendMessage(recipientId, text, accessToken, 'messenger');
}
