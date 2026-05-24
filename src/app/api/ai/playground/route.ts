import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { createCompletion, type ProviderConfig } from '@/lib/ai/openrouter';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = await checkRateLimit(user.id, 'ai_reply');
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait before trying again.' }, { status: 429 });
    }

    const { messageText, platform, platformRefId, businessId } = await request.json();
    if (!messageText) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const adminDb = await createAdminClient();

    const { data: deducted } = await adminDb.rpc('deduct_credit', { p_user_id: user.id });
    if (!deducted) {
      return NextResponse.json({
        error: 'You have no credits remaining. Please purchase more credits to continue.',
      }, { status: 403 });
    }

    const [profileRes, aiSettingsRes] = await Promise.all([
      adminDb.from('users').select('*').eq('id', user.id).single(),
      businessId
        ? adminDb.from('ai_settings').select('*').eq('user_id', user.id).eq('business_id', businessId).maybeSingle()
        : adminDb.from('ai_settings').select('*').eq('user_id', user.id).limit(1).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const [providerRes, configRes, reasoningCfg, memoryCountCfg, tempCfg, tokensCfg, reasoningTokensCfg] = await Promise.all([
      adminDb.from('ai_providers').select('*').eq('is_active', true).order('sort_order').limit(1).maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'reasoning_enabled').maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'default_conversation_memory_count').maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'default_temperature').maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'default_max_tokens').maybeSingle(),
      adminDb.from('platform_settings').select('value').eq('key', 'reasoning_max_tokens').maybeSingle(),
    ]) as any;
    const defaultMemoryCount = memoryCountCfg?.data?.value ? Number(memoryCountCfg.data.value) : 10;
    const defaultTemperature = tempCfg?.data?.value ? Number(tempCfg.data.value) : 0.7;
    const defaultMaxTokens = tokensCfg?.data?.value ? Number(tokensCfg.data.value) : 500;

    const aiSettings = aiSettingsRes.data || {
      model: 'openai/gpt-4o-mini',
      system_prompt: null,
      temperature: defaultTemperature,
      max_tokens: defaultMaxTokens,
      fallback_response: '',
      greeting_enabled: true,
      greeting_message: 'Hello! How can we help you today?',
      conversation_memory_count: defaultMemoryCount,
      is_active: true,
    };

    let providerConfig: ProviderConfig | undefined;
    let activeModel = aiSettings.model || 'openai/gpt-4o-mini';
    let masterPrompt: string | null = null;
    let reasoningEnabled = true;
    let reasoningMaxTokens = 512;

    if (!providerRes.error && providerRes.data) {
      try {
        providerConfig = {
          baseUrl: providerRes.data.base_url,
          apiKey: decrypt(providerRes.data.api_key),
          providerType: providerRes.data.provider_type,
        };
        activeModel = providerRes.data.default_model || activeModel;
      } catch {
        console.warn('Playground: failed to decrypt provider key, falling back');
      }
    }

    masterPrompt = configRes.data?.value as string || null;
    reasoningEnabled = reasoningCfg?.data?.value === true || reasoningCfg?.data?.value === 'true';
    reasoningMaxTokens = reasoningTokensCfg?.data?.value ? Number(reasoningTokensCfg.data.value) : 512;

    // Fetch knowledge base using junction table (platform-scoped)
    let filteredKB: Array<{ category: string; title: string; content: string }> = [];
    if (platform) {
      const { data: kbLinks } = platformRefId
        ? await adminDb
            .from('knowledge_base_platforms')
            .select('kb_id')
            .eq('platform', platform)
            .or(`platform_ref_id.eq.${platformRefId},platform_ref_id.is.null`)
        : await adminDb
            .from('knowledge_base_platforms')
            .select('kb_id')
            .eq('platform', platform);

      const kbIds = kbLinks?.map(r => r.kb_id) || [];
      if (kbIds.length > 0) {
        const { data } = await adminDb
          .from('knowledge_base')
          .select('category, title, content')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .in('id', kbIds)
          .order('sort_order');
        filteredKB = data || [];
      }
    } else {
      // Fallback: fetch all active KB entries (backward compatible)
      const { data } = await adminDb
        .from('knowledge_base')
        .select('category, title, content')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order');
      filteredKB = data || [];
    }

    const businessInfo = {
      name: profile?.business_name || profile?.full_name || 'Business',
      description: profile?.business_name || '',
    };

    let orderInstruction = '';
    if (profile?.order_method === 'website') {
      orderInstruction = `When the customer wants to place an order, say: 'Please complete your order here: ${profile.order_link || 'our website'}'`;
    } else if (profile?.order_method === 'form') {
      orderInstruction = `When the customer wants to place an order, say: 'Please fill out this form: ${profile.order_link || 'our order form'}'`;
    } else if (profile?.order_method === 'direct_chat') {
      orderInstruction = `When the customer wants to place an order, ask for their Name, Phone, Address, and Product details. Once they provide ALL four pieces of information, call the extract_order_details tool to save the order.`;
    }

    let systemPrompt = buildSystemPrompt(businessInfo, filteredKB, aiSettings, masterPrompt)
      + (orderInstruction ? `\n\n## Order Collection\n${orderInstruction}` : '');

    const baseTools: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }> = [];

    // Always include search_products tool
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

    if (profile?.order_method === 'direct_chat') {
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

    const tools = baseTools.length > 0 ? baseTools : undefined;

    const response = await createCompletion({
      model: activeModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText },
      ],
      temperature: aiSettings.temperature ?? defaultTemperature,
      max_tokens: aiSettings.max_tokens ?? defaultMaxTokens,
      tools,
    }, providerConfig, !reasoningEnabled, reasoningMaxTokens);

    const choice = response.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    let finalReply = choice?.message?.content || '';
    const tokens = response.usage?.total_tokens || 0;

    // Handle tool calls
    if (toolCall) {
      if (toolCall.function.name === 'search_products') {
        const args = JSON.parse(toolCall.function.arguments);
        const searchQuery = args.query || '';

        let searchReq = adminDb
          .from('products')
          .select('name, description, price, category, image_url')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .textSearch('name', searchQuery, { type: 'websearch' });

        if (!searchQuery) {
          searchReq = adminDb
            .from('products')
            .select('name, description, price, category, image_url')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        }

        if (platformRefId) {
          searchReq = searchReq.or(`platform_ref_id.eq.${platformRefId},platform_ref_id.is.null`);
        }

        const { data: products } = await searchReq.limit(10);

        const productList = products && products.length > 0
          ? products.map((p: any) =>
              `- ${p.name}${p.price ? ' ($' + p.price + ')' : ''}${p.description ? ': ' + p.description : ''}`
            ).join('\n')
          : 'No products found for "' + searchQuery + '".';

        const toolResult = '## Product Search Results for "' + searchQuery + '"\n' + productList;

        const followUp = await createCompletion({
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messageText },
            { role: 'assistant', content: null, tool_calls: [toolCall] },
            { role: 'tool', tool_call_id: toolCall.id, content: toolResult },
          ],
          temperature: aiSettings.temperature ?? defaultTemperature,
          max_tokens: aiSettings.max_tokens ?? defaultMaxTokens,
        }, providerConfig, !reasoningEnabled, reasoningMaxTokens);

        finalReply = followUp.choices?.[0]?.message?.content || 'No response generated.';
      } else if (toolCall.function.name === 'extract_order_details') {
        finalReply = 'Order details extracted successfully. (Order saved in real conversations)';
      }
    }

    await adminDb.from('usage_logs').insert({
      user_id: user.id,
      action: 'ai_reply',
      platform: null,
      tokens_used: tokens,
      model_used: activeModel,
      metadata: { source: 'playground' },
    });

    return NextResponse.json({ reply: finalReply });
  } catch (error) {
    console.error('Playground error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
