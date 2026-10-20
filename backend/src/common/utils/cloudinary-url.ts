/** Lấy public_id Cloudinary từ URL ảnh, trả về null nếu không phải URL Cloudinary */
export const extractCloudinaryPublicId = (url: string): string | null => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
};
