import type { RetryableProvider, ProviderRole } from '@/lib/ai/types';

interface RouterInput {
  hasImage: boolean;
  hasVoice: boolean;
  mediaSettings: Record<string, unknown>;
  providers: RetryableProvider[];
}

interface RouterOutput {
  visionProvider: RetryableProvider | null;
  voiceProvider: RetryableProvider | null;
  visionModel: string;
  voiceModel: string;
}

function findProviderByRole(providers: RetryableProvider[], role: ProviderRole): RetryableProvider | null {
  return providers.find(p => p.roles.includes(role)) || null;
}

function findProviderById(providers: RetryableProvider[], id: string): RetryableProvider | null {
  return providers.find(p => p.id === id) || null;
}

export function resolveMediaProviders(input: RouterInput): RouterOutput {
  const result: RouterOutput = {
    visionProvider: null,
    voiceProvider: null,
    visionModel: String(input.mediaSettings.media_image_model || 'openai/gpt-4o-mini'),
    voiceModel: String(input.mediaSettings.media_voice_model || 'openai/whisper-large-v3-turbo'),
  };

  if (input.hasImage) {
    const providerId = String(input.mediaSettings.media_image_provider_id || '');
    if (providerId) {
      result.visionProvider = findProviderById(input.providers, providerId);
    }
    if (!result.visionProvider) {
      result.visionProvider = findProviderByRole(input.providers, 'vision');
    }
    if (result.visionProvider) {
      result.visionModel = result.visionProvider.model;
    }
  }

  if (input.hasVoice) {
    const providerId = String(input.mediaSettings.media_voice_provider_id || '');
    if (providerId) {
      result.voiceProvider = findProviderById(input.providers, providerId);
    }
    if (!result.voiceProvider) {
      result.voiceProvider = findProviderByRole(input.providers, 'voice');
    }
    if (result.voiceProvider) {
      result.voiceModel = result.voiceProvider.model;
    }
  }

  return result;
}
