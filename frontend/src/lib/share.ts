export type ShareResult = 'shared' | 'copied' | 'cancelled';

/** Chia sẻ liên kết bằng Web Share hoặc sao chép vào clipboard */
export async function shareUrl({ title, url }: { title: string; url: string }): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Lỗi khác thì thử clipboard
    }
  }
  if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Trình duyệt không hỗ trợ chia sẻ hoặc sao chép liên kết');
  await navigator.clipboard.writeText(url);
  return 'copied';
}
