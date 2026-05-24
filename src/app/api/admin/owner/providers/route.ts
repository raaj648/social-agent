import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

function maskKey(key: string): string {
  if (key.length <= 12) return key.slice(0, 4) + '...' + key.slice(-4);
  return key.slice(0, 8) + '...' + key.slice(-4);
}

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const { data: providers } = await supabase
      .from('ai_providers')
      .select('*')
      .order('sort_order');

    const masked = (providers || []).map((p: any) => ({
      ...p,
      api_key: maskKey(p.api_key),
    }));

    return NextResponse.json({ providers: masked });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const { name, base_url, api_key, default_model, provider_type, reasoning_max_tokens, is_active, sort_order } = await request.json();
    if (!name || !base_url || !api_key) {
      return NextResponse.json({ error: 'name, base_url, and api_key are required' }, { status: 400 });
    }

    const encryptedKey = encrypt(api_key);

    const insertData: Record<string, unknown> = {
      name,
      base_url,
      api_key: encryptedKey,
      default_model: default_model || 'gpt-4o-mini',
      is_active: is_active !== undefined ? is_active : true,
      sort_order: sort_order || 0,
    };
    if (provider_type) insertData.provider_type = provider_type;
    if (reasoning_max_tokens !== undefined && reasoning_max_tokens !== '') {
      insertData.reasoning_max_tokens = parseInt(reasoning_max_tokens) || null;
    }

    const { data, error } = await supabase
      .from('ai_providers')
      .insert(insertData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ provider: { ...data, api_key: maskKey(data.api_key) } });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
