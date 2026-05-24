import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const AI_KEYS = ['default_model', 'default_free_credits', 'default_credits_expiry_days', 'openrouter_key'];
const AI_NUMERIC_KEYS = ['default_conversation_memory_count', 'default_temperature', 'default_max_tokens', 'reasoning_max_tokens'];

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const [configRes, reasoningEnabledRes, settingsRes] = await Promise.all([
      supabase.from('platform_settings').select('value').eq('key', 'master_prompt').maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'reasoning_enabled').maybeSingle(),
      supabase.from('platform_settings').select('key, value'),
    ]);

    const result: Record<string, unknown> = {
      master_prompt: configRes.data?.value as string || null,
      reasoning_enabled: reasoningEnabledRes.data?.value === true || reasoningEnabledRes.data?.value === 'true' ? true : false,
      default_conversation_memory_count: settingsRes.data?.find(s => s.key === 'default_conversation_memory_count')?.value || 10,
      default_temperature: settingsRes.data?.find(s => s.key === 'default_temperature')?.value || 0.7,
      default_max_tokens: settingsRes.data?.find(s => s.key === 'default_max_tokens')?.value || 500,
      reasoning_max_tokens: settingsRes.data?.find(s => s.key === 'reasoning_max_tokens')?.value || 512,
    };

    const settings = settingsRes.data || [];
    for (const s of settings) {
      if (AI_KEYS.includes(s.key)) {
        result[s.key] = s.key === 'openrouter_key' ? true : s.value;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const body = await request.json();

    if (body.master_prompt !== undefined) {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key: 'master_prompt', value: body.master_prompt || '' }, { onConflict: 'key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.reasoning_enabled !== undefined) {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key: 'reasoning_enabled', value: Boolean(body.reasoning_enabled) }, { onConflict: 'key' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const key of AI_NUMERIC_KEYS) {
      if (body[key] !== undefined) {
        const val = typeof body[key] === 'string'
          ? key === 'default_temperature' ? parseFloat(body[key]) || 0.7 : parseInt(body[key]) || 10
          : key === 'default_temperature' ? Number(body[key]) || 0.7 : Number(body[key]) || 10;
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key, value: val }, { onConflict: 'key' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    for (const key of AI_KEYS) {
      if (body[key] !== undefined) {
        if (key === 'openrouter_key' && (body[key] === '' || body[key] === null)) continue;
        const value = key === 'openrouter_key' ? encrypt(String(body[key])) : body[key];
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key, value }, { onConflict: 'key' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
