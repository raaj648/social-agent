import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createCompletion } from '@/lib/ai/openrouter';
import { getOpenRouterKey } from '@/lib/credentials';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const { model, messages, systemPrompt, providerId } = await request.json();
    if (!model) return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    let apiKey: string;
    let baseUrl: string;

    if (providerId) {
      const { data: provider, error } = await supabase
        .from('ai_providers')
        .select('api_key, base_url')
        .eq('id', providerId)
        .single();

      if (error || !provider) {
        return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
      }

      try { apiKey = decrypt(provider.api_key); } catch {
        apiKey = provider.api_key;
      }
      baseUrl = provider.base_url;
    } else {
      apiKey = await getOpenRouterKey();
      baseUrl = 'https://openrouter.ai/api/v1';
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured. Add a provider or set the OpenRouter key.' }, { status: 400 });
    }

    let effectiveSystemPrompt = systemPrompt;

    // Inject master prompt if set
    const { data: masterPromptData } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'master_prompt')
      .maybeSingle();
    const masterPrompt = masterPromptData?.value as string | null;
    if (masterPrompt) {
      effectiveSystemPrompt = effectiveSystemPrompt
        ? `${masterPrompt}\n\n---\n\n${effectiveSystemPrompt}`
        : masterPrompt;
    }

    // Fetch reasoning settings
    const { data: reasoningCfg } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'reasoning_enabled')
      .maybeSingle();
    const { data: reasoningPromptCfg } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'reasoning_suppression_prompt')
      .maybeSingle();
    const reasoningEnabled = reasoningCfg?.value === true || reasoningCfg?.value === 'true';
    const reasoningSuppressionPrompt = (reasoningPromptCfg?.value as string) || '';

    if (!reasoningEnabled && reasoningSuppressionPrompt) {
      effectiveSystemPrompt = effectiveSystemPrompt
        ? `${effectiveSystemPrompt}\n\n## Reasoning Suppression\n${reasoningSuppressionPrompt}`
        : `## Reasoning Suppression\n${reasoningSuppressionPrompt}`;
    }

    const chatMessages = effectiveSystemPrompt
      ? [{ role: 'system', content: effectiveSystemPrompt }, ...messages]
      : messages;

    const response = await createCompletion(
      { model, messages: chatMessages },
      { baseUrl, apiKey },
      !reasoningEnabled
    );

    const timeMs = Date.now() - start;
    const reply = response.choices?.[0]?.message?.content || '';
    const tokens = response.usage?.total_tokens || 0;

    return NextResponse.json({ reply, model, tokens, timeMs });
  } catch (error) {
    const timeMs = Date.now() - start;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal error',
      timeMs,
    }, { status: 500 });
  }
}
