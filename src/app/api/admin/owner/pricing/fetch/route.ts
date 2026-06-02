import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOpenRouterPricing, DEFAULT_PRICING } from '@/lib/ai/pricing';

export const dynamic = 'force-dynamic';

function buildKnownModels(dbModels: string[], platformSettings: Record<string, string>, providerDefaultModels: string[]): Set<string> {
  const known = new Set<string>();

  // All keys from DEFAULT_PRICING
  for (const key of Object.keys(DEFAULT_PRICING)) {
    known.add(key);
    // Also add base name (after the /)
    if (key.includes('/')) known.add(key.split('/').pop()!);
  }

  // All model_names already in the DB
  for (const m of dbModels) known.add(m);

  // Default media models from platform_settings
  const mediaImageModel = platformSettings['media_image_model'];
  const mediaVoiceModel = platformSettings['media_voice_model'];
  const platformDefaultModel = platformSettings['default_model'];
  if (mediaImageModel) known.add(mediaImageModel);
  if (mediaVoiceModel) known.add(mediaVoiceModel);
  if (platformDefaultModel) known.add(platformDefaultModel);

  // Provider default models
  for (const m of providerDefaultModels) {
    if (m) known.add(m);
  }

  return known;
}

function matchesKnownModel(openRouterModelId: string, knownModels: Set<string>): boolean {
  if (knownModels.has(openRouterModelId)) return true;
  const baseName = openRouterModelId.includes('/') ? openRouterModelId.split('/').pop()! : openRouterModelId;
  if (knownModels.has(baseName)) return true;
  for (const known of Array.from(knownModels)) {
    if (openRouterModelId.startsWith(known) || openRouterModelId.includes(known)) return true;
    if (known.startsWith(openRouterModelId)) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: isAdmin } = await authSupabase.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = await createAdminClient();

    let targetModels: Set<string> | null = null;

    // Parse request body if provided
    if (request) {
      try {
        const body = await request.json();
        if (Array.isArray(body.models) && body.models.length > 0) {
          targetModels = new Set(body.models.map((m: string) => m.trim()).filter(Boolean));
        }
      } catch { /* no body or invalid JSON — use default behavior */ }
    }

    // If no explicit models requested, build known model set from project defaults
    if (!targetModels) {
      const { data: existingPricing } = await supabase
        .from('model_pricing')
        .select('model_name');

      const { data: settingsRows } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['default_model', 'media_image_model', 'media_voice_model']);

      const platformSettings: Record<string, string> = {};
      if (settingsRows) {
        for (const row of settingsRows) {
          platformSettings[row.key] = String(row.value);
        }
      }

      // Fetch provider default models
      const { data: providers } = await supabase
        .from('ai_providers')
        .select('default_model')
        .eq('is_active', true);

      const providerDefaultModels = (providers || [])
        .map((p: any) => p.default_model)
        .filter(Boolean);

      const dbModelNames = (existingPricing || []).map((r: any) => r.model_name);
      targetModels = buildKnownModels(dbModelNames, platformSettings, providerDefaultModels);
    }

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
    let matchedModels = 0;

    // Upsert pricing for each OpenRouter provider, only for target models
    for (const provider of orProviders) {
      for (const [modelName, prices] of Object.entries(remotePrices)) {
        if (!matchesKnownModel(modelName, targetModels)) continue;
        matchedModels++;
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

    return NextResponse.json({ updated, total: Object.keys(remotePrices).length, matched: matchedModels });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
