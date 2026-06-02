import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_PRICING, PRICING_UNITS } from '@/lib/ai/pricing';

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

    // Collect all model names that need pricing (from DEFAULT_PRICING + configured models)
    const modelEntries: Array<{ model: string; input: number; output: number }> = [];

    for (const [modelName, prices] of Object.entries(DEFAULT_PRICING)) {
      modelEntries.push({ model: modelName, input: prices.input, output: prices.output });
    }

    // Fetch configured models from providers and platform_settings
    const { data: allProviders } = await supabase
      .from('ai_providers')
      .select('default_model')
      .eq('is_active', true);

    const { data: platformModels } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['default_model', 'media_image_model', 'media_voice_model']);

    const configuredModels = new Set<string>();
    if (allProviders) {
      for (const p of allProviders) {
        if (p.default_model) configuredModels.add(p.default_model);
      }
    }
    if (platformModels) {
      for (const row of platformModels) {
        if (row.value) configuredModels.add(String(row.value));
      }
    }

    const existingDefaults = new Set(Object.keys(DEFAULT_PRICING));

    // Upsert pricing for ALL active providers
    let updated = 0;

    for (const provider of providers) {
      for (const entry of modelEntries) {
        const unit = PRICING_UNITS[entry.model] || 'per_1m_tokens';
        const { error } = await supabase
          .from('model_pricing')
          .upsert({
            provider_id: provider.id,
            model_name: entry.model,
            input_price_per_1m_tokens: entry.input,
            output_price_per_1m_tokens: entry.output,
            pricing_unit: unit,
            is_auto_fetched: false,
          }, { onConflict: 'provider_id,model_name' });

        if (!error) updated++;
      }

      // Also upsert configured models (e.g. provider's default_model) that aren't in DEFAULT_PRICING
      const configuredArr = Array.from(configuredModels);
      for (let ci = 0; ci < configuredArr.length; ci++) {
        const modelName = configuredArr[ci];
        if (existingDefaults.has(modelName)) continue;
        if (modelName.includes('/')) {
          const baseName = modelName.split('/').pop()!;
          if (existingDefaults.has(baseName)) continue;
        }
        const unit = PRICING_UNITS[modelName] || 'per_1m_tokens';
        const { error } = await supabase
          .from('model_pricing')
          .upsert({
            provider_id: provider.id,
            model_name: modelName,
            input_price_per_1m_tokens: 0,
            output_price_per_1m_tokens: 0,
            pricing_unit: unit,
            is_auto_fetched: false,
          }, { onConflict: 'provider_id,model_name' });

        if (!error) updated++;
      }
    }

    return NextResponse.json({ updated, total: modelEntries.length + providers.length * configuredModels.size });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
