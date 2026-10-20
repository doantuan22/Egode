/** Kiểm tra ảnh đánh giá trước khi gửi lên Cloudinary */
import { AppError } from '../../common/errors/app-error';
import { MAX_IMAGE_BYTES, validateImageDataUri } from '../../common/utils/image-upload';

export const MAX_REVIEW_IMAGES = 6;
export { MAX_IMAGE_BYTES };

/** Ném lỗi ở ảnh không hợp lệ đầu tiên */
export const validateReviewImages = (images: string[] | undefined): void => {
  if (!images || images.length === 0) return;
  if (images.length > MAX_REVIEW_IMAGES) {
    throw AppError.badRequest(`Tối đa ${MAX_REVIEW_IMAGES} ảnh cho mỗi đánh giá`);
  }
  for (const image of images) {
    validateImageDataUri(image);
  }
};
