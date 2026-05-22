import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { createCompletion } from '@/lib/ai/openrouter';
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

    const { messageText } = await request.json();
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
      adminDb.from('ai_settings').select('*').eq('user_id', user.id).limit(1).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const aiSettings = aiSettingsRes.data || {
      model: 'openai/gpt-4o-mini',
      system_prompt: null,
      temperature: 0.7,
      max_tokens: 500,
      fallback_response: "Thanks for your message! We'll get back to you shortly.",
      greeting_enabled: true,
      greeting_message: 'Hello! How can we help you today?',
      conversation_memory_count: 10,
      is_active: true,
    };

    let providerConfig: { baseUrl: string; apiKey: string } | undefined;
    let activeModel = aiSettings.model || 'openai/gpt-4o-mini';
    let masterPrompt: string | null = null;

    const [providerRes, configRes] = await Promise.all([
      adminDb.from('ai_providers').select('*').eq('is_active', true).order('sort_order').limit(1).single(),
      adminDb.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
    ]);

    if (!providerRes.error && providerRes.data) {
      try {
        providerConfig = {
          baseUrl: providerRes.data.base_url,
          apiKey: decrypt(providerRes.data.api_key),
        };
        activeModel = providerRes.data.default_model || activeModel;
      } catch {
        console.warn('Playground: failed to decrypt provider key, falling back');
      }
    }

    masterPrompt = configRes.data?.value as string || null;

    const { data: knowledgeBase } = await adminDb
      .from('knowledge_base')
      .select('category, title, content')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order');

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

    const systemPrompt = buildSystemPrompt(businessInfo, knowledgeBase || [], aiSettings, masterPrompt)
      + (orderInstruction ? `\n\n## Order Collection\n${orderInstruction}` : '');

    const tools = profile?.order_method === 'direct_chat' ? [{
      type: 'function' as const,
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
    }] : undefined;

    const response = await createCompletion({
      model: activeModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText },
      ],
      temperature: aiSettings.temperature || 0.7,
      max_tokens: aiSettings.max_tokens || 500,
      tools,
    }, providerConfig);

    const reply = response.choices?.[0]?.message?.content || '';
    const tokens = response.usage?.total_tokens || 0;

    await adminDb.from('usage_logs').insert({
      user_id: user.id,
      action: 'ai_reply',
      platform: null,
      tokens_used: tokens,
      model_used: activeModel,
      metadata: { source: 'playground' },
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Playground error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
