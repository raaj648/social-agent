import type { VoiceData } from '@/lib/media/types';
import { detectProviderType } from '@/lib/ai/provider';

interface TranscribeOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  providerType?: string;
}

export async function transcribeVoice(
  voice: VoiceData,
  options: TranscribeOptions
): Promise<{ transcript: string; durationSeconds: number } | null> {
  const apiKey = options.apiKey;
  const model = options.model || 'openai/whisper-large-v3-turbo';

  // Determine base URL
  let baseUrl: string;
  const providerType = options.providerType || detectProviderType(options.baseUrl || '');

  if (providerType === 'openrouter') {
    baseUrl = (options.baseUrl || 'https://openrouter.ai').replace(/\/+$/, '');
  } else if (providerType === 'openai') {
    baseUrl = options.baseUrl || 'https://api.openai.com';
  } else {
    // Direct OpenAI-compatible endpoint
    baseUrl = options.baseUrl || 'https://api.openai.com';
  }

  const endpoint = `${baseUrl}/v1/audio/transcriptions`;

  // Build multipart form
  const formData = new FormData();
  const mimeMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/flac': 'flac',
  };
  const ext = mimeMap[voice.mimeType] || 'ogg';
  const blob = new Blob([new Uint8Array(voice.data)], { type: voice.mimeType });
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Transcription failed (${res.status}): ${errText}`);
      return null;
    }

    const json = await res.json() as { text?: string; duration?: number };
    if (!json.text) return null;
    return { transcript: json.text, durationSeconds: json.duration ?? voice.durationSeconds ?? 30 };
  } catch (err) {
    console.error('Transcription error:', err);
    return null;
  }
}
