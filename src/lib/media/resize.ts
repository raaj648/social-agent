import sharp from 'sharp';
import type { ImageData } from '@/lib/media/types';

export async function resizeImage(
  buffer: Buffer,
  mimeType: string,
  maxSize: number
): Promise<{ data: Buffer; width: number; height: number; mimeType: string }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const longest = Math.max(metadata.width || 0, metadata.height || 0);
  if (longest <= maxSize) {
    return { data: buffer, width: metadata.width || 0, height: metadata.height || 0, mimeType };
  }
  const resized = await image
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const newMeta = await sharp(resized).metadata();
  return {
    data: resized,
    width: newMeta.width || 0,
    height: newMeta.height || 0,
    mimeType: 'image/jpeg',
  };
}

export function parseImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    let offset = 2;
    while (offset < buffer.length - 1) {
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xC0 || buffer[offset + 1] === 0xC2) {
        return {
          height: (buffer[offset + 5] << 8) + buffer[offset + 6],
          width: (buffer[offset + 7] << 8) + buffer[offset + 8],
        };
      }
      offset += 2 + ((buffer[offset + 2] << 8) + buffer[offset + 3]);
      if (buffer[offset] === 0xFF) continue;
      while (offset < buffer.length && buffer[offset] !== 0xFF) offset++;
    }
    return null;
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return {
      width: (buffer[16] << 24) + (buffer[17] << 16) + (buffer[18] << 8) + buffer[19],
      height: (buffer[20] << 24) + (buffer[21] << 16) + (buffer[22] << 8) + buffer[23],
    };
  }

  return null;
}

export async function checkImageSize(
  image: ImageData,
  maxSize: number
): Promise<{ needsResize: boolean; dimensions: { width: number; height: number } | null }> {
  const dims = image.width && image.height
    ? { width: image.width, height: image.height }
    : parseImageDimensions(image.data);
  if (!dims) return { needsResize: false, dimensions: null };
  return {
    needsResize: Math.max(dims.width, dims.height) > maxSize,
    dimensions: dims,
  };
}
