import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const AI_KEYS = ['default_model', 'default_free_credits', 'default_credits_expiry_days', 'openrouter_key'];
const AI_NUMERIC_KEYS = ['default_conversation_memory_count', 'default_temperature', 'default_max_tokens'];
const MEDIA_KEYS = ['media_image_enabled', 'media_image_provider_type', 'media_image_provider_id', 'media_image_model', 'media_image_max_size', 'media_image_max_count', 'media_image_fallback_text', 'media_voice_enabled', 'media_voice_provider_type', 'media_voice_provider_id', 'media_voice_model', 'media_voice_max_seconds', 'media_voice_fallback_text'];
const MEDIA_NUMERIC_KEYS = ['media_image_max_size', 'media_image_max_count', 'media_voice_max_seconds'];
const POINT_COST_KEYS = ['point_cost_text_reply', 'point_cost_image_read', 'point_cost_voice_read'];

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
    };

    // Add media settings defaults
    for (const key of MEDIA_KEYS) {
      const found = settingsRes.data?.find(s => s.key === key);
      if (found) {
        result[key] = found.value;
      } else {
        const defaults: Record<string, unknown> = {
          media_image_enabled: true,
          media_image_provider_type: 'openrouter',
          media_image_provider_id: '',
          media_image_model: 'openai/gpt-4o-mini',
          media_image_max_size: 2048,
          media_image_max_count: 3,
          media_image_fallback_text: '[User sent an image]',
          media_voice_enabled: true,
          media_voice_provider_type: 'openrouter',
          media_voice_provider_id: '',
          media_voice_model: 'openai/whisper-large-v3-turbo',
          media_voice_max_seconds: 120,
          media_voice_fallback_text: '[User sent a voice message]',
        };
        result[key] = defaults[key];
      }
    }

    // Point cost defaults
    for (const key of POINT_COST_KEYS) {
      const found = settingsRes.data?.find(s => s.key === key);
      if (found) {
        result[key] = Number(found.value);
      } else {
        const costDefaults: Record<string, number> = {
          point_cost_text_reply: 1,
          point_cost_image_read: 3,
          point_cost_voice_read: 2,
        };
        result[key] = costDefaults[key];
      }
    }

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
        const raw = body[key];
        let val: number;
        if (key === 'default_temperature') {
          val = typeof raw === 'string' ? parseFloat(raw) || 0.7 : Number(raw) || 0.7;
        } else {
          val = typeof raw === 'string' ? parseInt(raw) || 10 : Number(raw) || 10;
        }
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

    for (const key of MEDIA_KEYS) {
      if (body[key] !== undefined) {
        let val: unknown = body[key];
        if (MEDIA_NUMERIC_KEYS.includes(key)) {
          val = typeof val === 'string' ? parseInt(val) || 0 : Number(val) || 0;
        }
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key, value: val }, { onConflict: 'key' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    for (const key of POINT_COST_KEYS) {
      if (body[key] !== undefined) {
        const val = typeof body[key] === 'number' ? body[key] : parseInt(String(body[key])) || 1;
        const { error } = await supabase
          .from('platform_settings')
          .upsert({ key, value: val }, { onConflict: 'key' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
