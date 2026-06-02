import { downloadBuffer } from '@/lib/media/download';
import type { MediaBundle, ImageData, VoiceData } from '@/lib/media/types';

interface WhatsAppMediaMsg {
  id?: string;
  mime_type?: string;
  sha256?: string;
}

interface WhatsAppMessage {
  image?: WhatsAppMediaMsg;
  video?: WhatsAppMediaMsg;
  audio?: WhatsAppMediaMsg;
  voice?: WhatsAppMediaMsg;
  document?: WhatsAppMediaMsg;
}

async function resolveWhatsAppMedia(mediaId: string, accessToken: string): Promise<string> {
  const res = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json() as { url?: string; mime_type?: string };
  if (!json.url) {
    throw new Error(`WhatsApp media resolve failed for ${mediaId}`);
  }
  return json.url;
}

export async function processWhatsAppMedia(
  message: WhatsAppMessage | undefined,
  accessToken: string
): Promise<MediaBundle | null> {
  if (!message) return null;

  const images: ImageData[] = [];
  let voice: VoiceData | null = null;

  // Image
  if (message.image?.id) {
    try {
      const url = await resolveWhatsAppMedia(message.image.id, accessToken);
      const buffer = await downloadBuffer(url, `Bearer ${accessToken}`);
      images.push({
        data: buffer,
        mimeType: message.image.mime_type || 'image/jpeg',
      });
    } catch (err) {
      console.error('WhatsApp image download failed:', err);
    }
  }

  // Voice message
  if (message.voice?.id) {
    try {
      const url = await resolveWhatsAppMedia(message.voice.id, accessToken);
      const buffer = await downloadBuffer(url, `Bearer ${accessToken}`);
      voice = {
        data: buffer,
        mimeType: message.voice.mime_type || 'audio/ogg',
      };
    } catch (err) {
      console.error('WhatsApp voice download failed:', err);
    }
  }

  // Audio
  if (message.audio?.id && !voice) {
    try {
      const url = await resolveWhatsAppMedia(message.audio.id, accessToken);
      const buffer = await downloadBuffer(url, `Bearer ${accessToken}`);
      voice = {
        data: buffer,
        mimeType: message.audio.mime_type || 'audio/mpeg',
      };
    } catch (err) {
      console.error('WhatsApp audio download failed:', err);
    }
  }

  // Video
  if (message.video?.id) {
    try {
      const url = await resolveWhatsAppMedia(message.video.id, accessToken);
      const buffer = await downloadBuffer(url, `Bearer ${accessToken}`);
      images.push({
        data: buffer,
        mimeType: message.video.mime_type || 'video/mp4',
      });
    } catch (err) {
      console.error('WhatsApp video download failed:', err);
    }
  }

  if (images.length === 0 && !voice) return null;

  return {
    images,
    voice,
    fallbackText: images.length > 0 ? '[User sent an image]' : '[User sent a voice message]',
  };
}
