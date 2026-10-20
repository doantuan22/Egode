import cloudinary from '../config/cloudinary';

export interface UploadImageResult {
  url: string;
  publicId: string;
}

// Giới hạn thời gian chờ khi gọi Cloudinary
const UPLOAD_TIMEOUT_MS = 15_000;
const DELETE_TIMEOUT_MS = 8_000;

// Bổ sung kiểu cho tùy chọn timeout của destroy()
interface DestroyOptionsWithTimeout {
  resource_type: 'image';
  invalidate: boolean;
  timeout: number;
}

export class CloudinaryIntegration {
  static async uploadImage(
    filePathOrBase64: string,
    folder = 'hotel-booking'
  ): Promise<UploadImageResult> {
    const result = await cloudinary.uploader.upload(filePathOrBase64, {
      folder,
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      unique_filename: true,
      overwrite: false,
      timeout: UPLOAD_TIMEOUT_MS,
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  static async deleteImage(publicId: string): Promise<boolean> {
    // Ép kiểu hẹp để truyền timeout vào destroy()
    const options: DestroyOptionsWithTimeout = { resource_type: 'image', invalidate: true, timeout: DELETE_TIMEOUT_MS };
    const result = await cloudinary.uploader.destroy(publicId, options);
    return result.result === 'ok';
  }
}
