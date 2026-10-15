import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import cloudinary from '../../../backend/src/config/cloudinary';

export interface ImageManifestItem {
  key: string;
  hotelKey: string;
  hotelName: string;
  group: 'exterior' | 'lobby' | 'pool' | 'restaurant' | 'room';
  title: string;
  sourceUrl: string;
  pageUrl: string;
  author: string;
  license: string;
  publicId?: string;
  secureUrl?: string;
  width?: number;
  height?: number;
  status: 'PENDING' | 'UPLOADED' | 'FAILED';
}

const USER_AGENT = 'HotelBookingProductionBootstrap/1.0 (seed-dataset-bootstrap@egode.vn)';

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`Not an image (${type}) for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`;
}

export async function uploadSingleImage(
  item: ImageManifestItem,
  folder: string,
  publicId: string
): Promise<{ secureUrl: string; publicId: string; width: number; height: number }> {
  const dataUri = await toDataUri(item.sourceUrl);
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    transformation: [{ width: 1600, crop: 'limit' }],
    timeout: 60_000,
  });
  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}
