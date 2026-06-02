import { downloadBuffer } from '@/lib/media/download';
import type { MediaBundle, ImageData, VoiceData } from '@/lib/media/types';

interface DiscordAttachment {
  id: string;
  filename: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  width?: number;
  height?: number;
  duration_secs?: number;
}

export async function processDiscordMedia(
  attachments: Record<string, unknown> | undefined
): Promise<MediaBundle | null> {
  if (!attachments || Object.keys(attachments).length === 0) return null;

  const images: ImageData[] = [];
  let voice: VoiceData | null = null;

  for (const [, att] of Object.entries(attachments)) {
    const attachment = att as DiscordAttachment;
    const ct = attachment.content_type || '';

    if (ct.startsWith('image/')) {
      try {
        const buffer = await downloadBuffer(attachment.url);
        images.push({
          data: buffer,
          mimeType: ct,
          width: attachment.width,
          height: attachment.height,
        });
      } catch (err) {
        console.error('Discord image download failed:', err);
      }
    } else if (ct.startsWith('audio/')) {
      try {
        const buffer = await downloadBuffer(attachment.url);
        voice = {
          data: buffer,
          mimeType: ct,
          durationSeconds: attachment.duration_secs,
        };
      } catch (err) {
        console.error('Discord audio download failed:', err);
      }
    }
  }

  if (images.length === 0 && !voice) return null;

  return {
    images,
    voice,
    fallbackText: images.length > 0 ? '[User sent an image]' : '[User sent a voice message]',
  };
}
