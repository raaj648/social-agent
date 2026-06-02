import type { RetryableProvider } from '@/lib/ai/types';

export class AllRetriesFailedError extends Error {
  public errors: Error[];
  public providerAttempts: string[];

  constructor(errors: Error[], providerAttempts: string[]) {
    super(`All ${errors.length} retry attempts failed`);
    this.name = 'AllRetriesFailedError';
    this.errors = errors;
    this.providerAttempts = providerAttempts;
  }
}

export async function executeWithFallback<T>(
  providers: RetryableProvider[],
  callFn: (provider: RetryableProvider) => Promise<T>,
  options?: { maxAttempts?: number; fallbackProviders?: RetryableProvider[] }
): Promise<{ result: T; providerUsed: RetryableProvider; attempts: number }> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const fallbackProviders = options?.fallbackProviders;
  const errors: Error[] = [];
  const providerAttempts: string[] = [];

  if (providers.length === 0) {
    throw new AllRetriesFailedError([new Error('No providers available for this role')], []);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const providerIndex = attempt % providers.length;
    const provider = providers[providerIndex];
    providerAttempts.push(`${provider.id} (${provider.model})`);

    try {
      const result = await callFn(provider);
      return { result, providerUsed: provider, attempts: attempt + 1 };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error);
      console.warn(
        `[retry] Attempt ${attempt + 1}/${maxAttempts} failed for provider ${provider.id} model ${provider.model}: ${error.message}`
      );
    }
  }

  if (fallbackProviders && fallbackProviders.length > 0) {
    console.warn(`[retry] Primary providers exhausted, trying ${fallbackProviders.length} fallback providers`);
    for (const fbProvider of fallbackProviders) {
      providerAttempts.push(`fallback:${fbProvider.id} (${fbProvider.model})`);
      try {
        const result = await callFn(fbProvider);
        return { result, providerUsed: fbProvider, attempts: maxAttempts };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        console.warn(`[retry] Fallback provider ${fbProvider.id} failed: ${error.message}`);
      }
    }
  }

  throw new AllRetriesFailedError(errors, providerAttempts);
}
