import { downloadBuffer } from '@/lib/media/download';
import type { MediaBundle, ImageData, VoiceData } from '@/lib/media/types';

interface MessengerAttachment {
  type: string;
  payload: {
    url?: string;
    sticker_id?: number;
  };
}

export async function processMessengerMedia(
  attachments: MessengerAttachment[] | undefined
): Promise<MediaBundle | null> {
  if (!attachments || attachments.length === 0) return null;

  const images: ImageData[] = [];
  let voice: VoiceData | null = null;

  for (const att of attachments) {
    if (!att.payload.url) continue;

    try {
      if (att.type === 'image' || att.type === 'sticker') {
        const buffer = await downloadBuffer(att.payload.url);
        const isSticker = att.type === 'sticker';
        images.push({
          data: buffer,
          mimeType: isSticker ? 'image/webp' : 'image/jpeg',
        });
      } else if (att.type === 'audio') {
        const buffer = await downloadBuffer(att.payload.url);
        voice = {
          data: buffer,
          mimeType: 'audio/mpeg',
        };
      } else if (att.type === 'video') {
        const buffer = await downloadBuffer(att.payload.url);
        images.push({
          data: buffer,
          mimeType: 'video/mp4',
        });
      }
    } catch (err) {
      console.error(`Messenger ${att.type} download failed:`, err);
    }
  }

  if (images.length === 0 && !voice) return null;

  return {
    images,
    voice,
    fallbackText: images.length > 0 ? '[User sent an image]' : '[User sent a voice message]',
  };
}
