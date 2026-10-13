import { useState } from 'react';
import { Button } from '../common/Button';
import { Textarea } from '../common/Textarea';
import { useCreateReview, useMyReview } from '../../features/reviews/hooks';
import { reviewStatusBadgeClass } from '../../features/reviews/status';
import { canReviewBooking } from '../../features/bookings/status';
import { fileToDataUrl, imageFileError, cn } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';

const MAX_IMAGES = 6;

interface ReviewSectionProps {
  bookingId: number;
  bookingStatus: string;
}

export function ReviewSection({ bookingId, bookingStatus }: ReviewSectionProps) {
  const isCompleted = canReviewBooking(bookingStatus);
  const reviewQuery = useMyReview(bookingId, isCompleted);
  const createMutation = useCreateReview(bookingId);

  const [score, setScore] = useState(5);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  if (!isCompleted) return null;

  const onFilesSelected = (list: FileList | null) => {
    if (!list) return;
    const selected = Array.from(list);
    if (selected.length > MAX_IMAGES) {
      setFileError(`Tối đa ${MAX_IMAGES} ảnh cho mỗi đánh giá.`);
      setFiles([]);
      return;
    }
    const validationError = selected.map(imageFileError).find(Boolean) ?? null;
    setFileError(validationError);
    setFiles(validationError ? [] : selected);
  };

  const submit = async () => {
    const hinhAnh = files.length > 0 ? await Promise.all(files.map(fileToDataUrl)) : undefined;
    createMutation.mutate({ diemDanhGia: score, noiDung: content.trim() || undefined, hinhAnh });
  };

  return (
    <div id="danh-gia" className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-white p-6 shadow-xs">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <i className="ph ph-chat-text text-[1.25rem] text-ink-muted" aria-hidden="true" /> Đánh giá
      </h2>

      {reviewQuery.isLoading ? (
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-blue-600" />
        </div>
      ) : reviewQuery.data ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <i
                  key={i}
                  className={cn('text-base', i < reviewQuery.data!.DiemDanhGia ? 'ph-fill ph-star text-warning' : 'ph ph-star text-border-strong')}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', reviewStatusBadgeClass(reviewQuery.data.TrangThai))}>
              {reviewQuery.data.TrangThai}
            </span>
          </div>
          {reviewQuery.data.NoiDung && <p className="text-sm text-ink-sub">{reviewQuery.data.NoiDung}</p>}
          {reviewQuery.data.HINH_ANH_DANH_GIA.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {reviewQuery.data.HINH_ANH_DANH_GIA.map((img, index) => (
                <img key={img.MaHinhAnhDanhGia} src={img.URL} alt={`Ảnh đánh giá ${index + 1}`} loading="lazy" decoding="async" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
          <p className="text-xs text-ink-muted">
            {reviewQuery.data.TrangThai === 'Hiển thị'
              ? 'Cảm ơn bạn đã đánh giá — đánh giá của bạn đã được hiển thị công khai.'
              : reviewQuery.data.TrangThai === 'Chờ duyệt'
                ? 'Cảm ơn bạn đã đánh giá — đánh giá đang chờ kiểm duyệt trước khi hiển thị công khai.'
                : 'Cảm ơn bạn đã đánh giá — đánh giá này hiện không được hiển thị công khai.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-ink-sub">Chấm điểm</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} sao`}
                  onClick={() => setScore(value)}
                  className="rounded p-0.5"
                >
                  <i className={cn('text-2xl', value <= score ? 'ph-fill ph-star text-warning' : 'ph ph-star text-border-strong')} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="review-content" className="mb-1 block text-xs font-medium text-ink-sub">
              Nhận xét (không bắt buộc)
            </label>
            <Textarea
              id="review-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn..."
            />
          </div>

          <div>
            <label htmlFor="review-images" className="mb-1 block text-xs font-medium text-ink-sub">
              Ảnh (tối đa {MAX_IMAGES}, không bắt buộc)
            </label>
            <input
              id="review-images"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(e) => onFilesSelected(e.target.files)}
              className="block w-full text-sm"
            />
            {files.length > 0 && <p className="mt-1 text-xs text-ink-muted">Đã chọn {files.length} ảnh</p>}
            {fileError && <p role="alert" className="mt-1 text-xs text-danger">{fileError}</p>}
          </div>

          {createMutation.isError && (
            <div role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger-ink">
              {createMutation.error instanceof ApiError ? createMutation.error.message : 'Không thể gửi đánh giá'}
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={createMutation.isPending || Boolean(fileError)}>
            {createMutation.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
          </Button>
        </div>
      )}
    </div>
  );
}
