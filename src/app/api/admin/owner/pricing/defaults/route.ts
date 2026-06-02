import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_PRICING } from '@/lib/ai/pricing';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    // Get the first active provider (prefer OpenRouter, then generic, then any)
    const { data: providers } = await supabase
      .from('ai_providers')
      .select('id, provider_type')
      .eq('is_active', true)
      .order('provider_type', { ascending: false })
      .order('sort_order');

    if (!providers || providers.length === 0) {
      return NextResponse.json({ error: 'No active AI providers found. Add a provider first.' }, { status: 400 });
    }

    // Use the primary provider (or upsert for all providers)
    const primaryProvider = providers[0];
    let updated = 0;

    for (const [modelName, prices] of Object.entries(DEFAULT_PRICING)) {
      const { error } = await supabase
        .from('model_pricing')
        .upsert({
          provider_id: primaryProvider.id,
          model_name: modelName,
          input_price_per_1m_tokens: prices.input,
          output_price_per_1m_tokens: prices.output,
          is_auto_fetched: false,
        }, { onConflict: 'provider_id,model_name' });

      if (!error) updated++;
    }

    return NextResponse.json({ updated, total: Object.keys(DEFAULT_PRICING).length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
