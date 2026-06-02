import type { TokenUsage, CostBreakdown, ActionType } from '@/lib/ai/types';

export const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4o-audio-preview': { input: 2.50, output: 10.00 },
  'openai/gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'nvidia/nemotron-3-super-120b-a12b:free': { input: 0, output: 0 },
  'google/gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'google/gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'deepseek/deepseek-v4-flash': { input: 0.0983, output: 0.1966 },
  'deepseek/deepseek-v4-pro': { input: 1.50, output: 4.00 },
  'deepseek/deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
  'openai/whisper-1': { input: 0.36, output: 0 },
  'openai/whisper-large-v3-turbo': { input: 0.36, output: 0 },
};

export const PRICING_UNITS: Record<string, 'per_1m_tokens' | 'per_hour'> = {
  'openai/whisper-1': 'per_hour',
  'openai/whisper-large-v3-turbo': 'per_hour',
};

export function getModelPrice(
  modelName: string,
  providerId: string,
  dbPrices: Map<string, { input: number; output: number }>
): { input: number; output: number } {
  const key = `${providerId}:${modelName}`;
  const dbEntry = dbPrices.get(key);
  if (dbEntry) return dbEntry;

  const hardcoded = DEFAULT_PRICING[modelName];
  if (hardcoded) return hardcoded;

  const baseName = modelName.includes('/') ? modelName.split('/').pop()! : modelName;
  const baseHardcoded = DEFAULT_PRICING[baseName];
  if (baseHardcoded) return baseHardcoded;

  // Reverse prefix match: modelName = "gpt-4o" → try "openai/gpt-4o"
  if (!modelName.includes('/')) {
    for (const prefix of ['openai/', 'google/', 'deepseek/', 'anthropic/']) {
      const prefixed = DEFAULT_PRICING[prefix + modelName];
      if (prefixed) return prefixed;
    }
  }

  return { input: 0, output: 0 };
}

export function calculateCost(tokens: TokenUsage, pricing: { input: number; output: number }): CostBreakdown {
  const input_cost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const output_cost = (tokens.output_tokens / 1_000_000) * pricing.output;
  return {
    input_cost,
    output_cost,
    total_cost: input_cost + output_cost,
  };
}

export function getBaselineCost(
  dbPricingMap: Map<string, { input: number; output: number }>,
  defaultModel: string,
  defaultProviderId: string
): number {
  const modelPricing = getModelPrice(defaultModel, defaultProviderId, dbPricingMap);
  if (modelPricing.input === 0 && modelPricing.output === 0) {
    return 0.000025;
  }
  return (200 / 1_000_000 * modelPricing.input) + (50 / 1_000_000 * modelPricing.output);
}

export function getWhisperCost(durationSeconds: number, providerType: string): number {
  const ratePerHour = providerType === 'openai' ? 0.36 : 0.04;
  return (durationSeconds / 3600) * ratePerHour;
}

export function calculateActionCredits(params: {
  actionType: ActionType;
  tokenUsage: TokenUsage;
  modelPricing: { input: number; output: number };
  baselineCost: number;
  whisperDurationSeconds?: number;
  whisperProviderType?: string;
}): number {
  let realCost: number;

  if (params.actionType === 'voice_read' && params.whisperDurationSeconds) {
    const whisperCost = getWhisperCost(
      params.whisperDurationSeconds,
      params.whisperProviderType || 'openrouter'
    );
    const textCost = calculateCost(params.tokenUsage, params.modelPricing).total_cost;
    realCost = whisperCost + textCost;
  } else {
    realCost = calculateCost(params.tokenUsage, params.modelPricing).total_cost;
  }

  return Math.max(1, Math.ceil(realCost / params.baselineCost));
}

export async function fetchOpenRouterPricing(): Promise<Record<string, { input: number; output: number }>> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const data = await res.json();
  const prices: Record<string, { input: number; output: number }> = {};
  for (const model of data.data || []) {
    if (model.pricing) {
      prices[model.id] = {
        input: (parseFloat(model.pricing.prompt) || 0) * 1_000_000,
        output: (parseFloat(model.pricing.completion) || 0) * 1_000_000,
      };
    }
  }
  return prices;
}
