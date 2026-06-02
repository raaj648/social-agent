export interface ImageData {
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface VoiceData {
  data: Buffer;
  mimeType: string;
  durationSeconds?: number;
}

export interface MediaBundle {
  images: ImageData[];
  voice: VoiceData | null;
  transcript?: string;
  fallbackText?: string;
}

export interface MediaRouterConfig {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}
