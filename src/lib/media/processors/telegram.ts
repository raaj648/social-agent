import { downloadBuffer } from '@/lib/media/download';
import type { MediaBundle, ImageData, VoiceData } from '@/lib/media/types';

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  file_size?: number;
}

interface TelegramMessage {
  photo?: TelegramPhotoSize[];
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  document?: TelegramDocument;
  video_note?: TelegramVideoNote;
}

async function resolveTelegramFile(fileId: string, botToken: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const json = await res.json() as { ok: boolean; result?: { file_path: string } };
  if (!json.ok || !json.result?.file_path) {
    throw new Error(`Telegram getFile failed for ${fileId}`);
  }
  return `https://api.telegram.org/file/bot${botToken}/${json.result.file_path}`;
}

export async function processTelegramMedia(
  message: TelegramMessage | undefined,
  botToken: string
): Promise<MediaBundle | null> {
  if (!message) return null;

  const images: ImageData[] = [];
  let voice: VoiceData | null = null;

  // Photo (largest size last)
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    try {
      const url = await resolveTelegramFile(largest.file_id, botToken);
      const buffer = await downloadBuffer(url);
      images.push({
        data: buffer,
        mimeType: 'image/jpeg',
        width: largest.width,
        height: largest.height,
      });
    } catch (err) {
      console.error('Telegram photo download failed:', err);
    }
  }

  // Voice message
  if (message.voice) {
    try {
      const url = await resolveTelegramFile(message.voice.file_id, botToken);
      const buffer = await downloadBuffer(url);
      voice = {
        data: buffer,
        mimeType: message.voice.mime_type || 'audio/ogg',
        durationSeconds: message.voice.duration,
      };
    } catch (err) {
      console.error('Telegram voice download failed:', err);
    }
  }

  // Audio
  if (message.audio && !voice) {
    try {
      const url = await resolveTelegramFile(message.audio.file_id, botToken);
      const buffer = await downloadBuffer(url);
      voice = {
        data: buffer,
        mimeType: message.audio.mime_type || 'audio/mpeg',
        durationSeconds: message.audio.duration,
      };
    } catch (err) {
      console.error('Telegram audio download failed:', err);
    }
  }

  // Video note (round video messages)
  if (message.video_note) {
    try {
      const url = await resolveTelegramFile(message.video_note.file_id, botToken);
      const buffer = await downloadBuffer(url);
      images.push({
        data: buffer,
        mimeType: 'video/mp4',
      });
    } catch (err) {
      console.error('Telegram video note download failed:', err);
    }
  }

  // Video (extract first frame later if needed — for now just note it as media)
  if (message.video) {
    try {
      const url = await resolveTelegramFile(message.video.file_id, botToken);
      const buffer = await downloadBuffer(url);
      images.push({
        data: buffer,
        mimeType: message.video.mime_type || 'video/mp4',
        width: message.video.width,
        height: message.video.height,
      });
    } catch (err) {
      console.error('Telegram video download failed:', err);
    }
  }

  if (images.length === 0 && !voice) return null;

  return {
    images,
    voice,
    fallbackText: images.length > 0 ? '[User sent an image]' : '[User sent a voice message]',
  };
}
