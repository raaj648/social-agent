import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOpenRouterPricing } from '@/lib/ai/pricing';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    // Get all OpenRouter providers
    const { data: orProviders } = await supabase
      .from('ai_providers')
      .select('id, base_url')
      .eq('provider_type', 'openrouter')
      .eq('is_active', true);

    if (!orProviders || orProviders.length === 0) {
      return NextResponse.json({ error: 'No active OpenRouter providers found' }, { status: 400 });
    }

    // Fetch pricing from OpenRouter API
    const remotePrices = await fetchOpenRouterPricing();
    let updated = 0;

    // Upsert pricing for each OpenRouter provider
    for (const provider of orProviders) {
      for (const [modelName, prices] of Object.entries(remotePrices)) {
        const { error } = await supabase
          .from('model_pricing')
          .upsert({
            provider_id: provider.id,
            model_name: modelName,
            input_price_per_1m_tokens: prices.input,
            output_price_per_1m_tokens: prices.output,
            is_auto_fetched: true,
          }, { onConflict: 'provider_id,model_name' });

        if (!error) updated++;
      }
    }

    return NextResponse.json({ updated, total: Object.keys(remotePrices).length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
