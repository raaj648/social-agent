import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    const { data: pricing, error } = await supabase
      .from('model_pricing')
      .select('*, ai_providers(name)')
      .order('provider_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ pricing });
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

    if (!Array.isArray(body.pricing)) {
      return NextResponse.json({ error: 'pricing must be an array' }, { status: 400 });
    }

    const results: Array<{ model_name: string; status: string }> = [];

    for (const item of body.pricing) {
      if (!item.provider_id || !item.model_name) continue;
      const { error } = await supabase
        .from('model_pricing')
        .upsert({
          provider_id: item.provider_id,
          model_name: item.model_name,
          input_price_per_1m_tokens: Number(item.input_price_per_1m_tokens) || 0,
          output_price_per_1m_tokens: Number(item.output_price_per_1m_tokens) || 0,
          is_auto_fetched: item.is_auto_fetched || false,
        }, { onConflict: 'provider_id,model_name' });

      results.push({
        model_name: item.model_name,
        status: error ? `error: ${error.message}` : 'ok',
      });
    }

    return NextResponse.json({ results, count: results.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
