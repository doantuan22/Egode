import { AppError } from '../errors/app-error';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_HOTEL_IMAGES = 20;
export const MAX_ROOM_TYPE_IMAGES = 20;

type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const DATA_URI_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i;

const hasValidSignature = (mime: AllowedImageMime, bytes: Buffer): boolean => {
  if (mime === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === 'image/png') {
    return bytes.length >= 8
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
};

/** Kiểm tra loại file, kích thước và magic bytes trước khi gửi lên Cloudinary */
export const validateImageDataUri = (value: string): string => {
  const match = value.match(DATA_URI_RE);
  if (!match) {
    throw AppError.badRequest('Ảnh phải là data URI base64 hợp lệ (JPEG/PNG/WEBP/GIF)');
  }

  const mime = match[1].toLowerCase() as AllowedImageMime;
  const encoded = match[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const decodedBytes = Math.floor((encoded.length * 3) / 4) - padding;
  if (decodedBytes <= 0 || decodedBytes > MAX_IMAGE_BYTES) {
    throw AppError.badRequest('Kích thước mỗi ảnh phải lớn hơn 0 và tối đa 5MB');
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== decodedBytes || !hasValidSignature(mime, bytes)) {
    throw AppError.badRequest('Nội dung ảnh không khớp với định dạng đã khai báo');
  }
  return `data:${mime};base64,${encoded}`;
};

export const assertImageCountBelowLimit = (currentCount: number, limit: number): void => {
  if (currentCount >= limit) throw AppError.badRequest(`Đã đạt giới hạn ${limit} ảnh`);
};
