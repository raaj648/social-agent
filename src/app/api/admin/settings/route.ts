import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { clearCredentialsCache } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

const SECRET_KEYS = new Set(['meta_app_secret', 'openrouter_key', 'meta_webhook_verify_token']);
const NUMERIC_KEYS = new Set(['message_retention_days', 'cleanup_cron_interval', 'rate_limit_per_min', 'admin_stats_refresh_interval']);

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const { data: settings } = await supabase.from('platform_settings').select('key, value');
    const result: Record<string, unknown> = {};
    if (settings) {
      for (const s of settings) {
        result[s.key] = SECRET_KEYS.has(s.key) ? true : s.value;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();
    const body = await request.json() as Record<string, unknown>;
    const errors: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (SECRET_KEYS.has(key) && (value === '' || value === null || value === undefined)) continue;

      let finalValue: unknown = value;
      if (SECRET_KEYS.has(key)) {
        finalValue = encrypt(String(value));
      } else if (NUMERIC_KEYS.has(key)) {
        finalValue = typeof value === 'string' ? parseInt(value) || 0 : Number(value) || 0;
      }

      const { error } = await supabase
        .from('platform_settings')
        .upsert({ key, value: finalValue }, { onConflict: 'key' });
      if (error) errors.push(`${key}: ${error.message}`);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 500 });
    }

    clearCredentialsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
