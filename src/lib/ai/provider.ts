export type ProviderType = 'openrouter' | 'deepseek' | 'generic';

export function detectProviderType(baseUrl: string, explicitType?: string): ProviderType {
  if (explicitType === 'openrouter' || explicitType === 'deepseek') return explicitType;
  if (baseUrl.includes('openrouter.ai')) return 'openrouter';
  if (baseUrl.includes('deepseek')) return 'deepseek';
  return 'generic';
}
