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

    const chatMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await createCompletion(
      { model, messages: chatMessages },
      { baseUrl, apiKey }
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
