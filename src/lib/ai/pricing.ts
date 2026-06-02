import type { TokenUsage, CostBreakdown } from '@/lib/ai/types';

const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-4o-audio-preview': { input: 2.50, output: 10.00 },
  'google/gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'google/gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'deepseek/deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek/deepseek-reasoner': { input: 0.55, output: 2.19 },
  'openai/whisper-1': { input: 6.00, output: 0 },
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
        input: parseFloat(model.pricing.prompt) || 0,
        output: parseFloat(model.pricing.completion) || 0,
      };
    }
  }
  return prices;
}
