export type ProviderType = 'openrouter' | 'deepseek' | 'google' | 'generic';

export function detectProviderType(baseUrl: string, explicitType?: string): ProviderType {
  if (explicitType === 'openrouter' || explicitType === 'deepseek' || explicitType === 'google') return explicitType;
  if (baseUrl.includes('openrouter.ai')) return 'openrouter';
  if (baseUrl.includes('deepseek')) return 'deepseek';
  if (baseUrl.includes('googleapis.com') || baseUrl.includes('generativelanguage')) return 'google';
  return 'generic';
}
