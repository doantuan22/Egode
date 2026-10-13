import { Link, useParams } from 'react-router-dom';
import { useAdminReviewDetail, useModerateReview, useRemoveViolationReview } from '../../features/reviews/hooks';
import { ApiError } from '../../services/apiClient';
import { useConfirm } from '../../components/common/FeedbackProvider';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { formatDateRangeVi } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

export default function AdminReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const reviewId = Number(id);
  const reviewQuery = useAdminReviewDetail(reviewId);
  const moderateMutation = useModerateReview();
  const removeMutation = useRemoveViolationReview();
  const confirm = useConfirm();

  if (reviewQuery.isLoading) {
    return <PageSpinner />;
  }

  if (reviewQuery.isError || !reviewQuery.data) {
    return <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">{reviewQuery.error instanceof ApiError ? reviewQuery.error.message : 'Không tìm thấy đánh giá'}</div>;
  }

  const r = reviewQuery.data;

  const renderStars = (score: number) => {
    const starsHTML = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= score) {
        starsHTML.push(<span key={i} className="text-warning">★</span>);
      } else {
        starsHTML.push(<span key={i} className="text-border-strong">★</span>);
      }
    }
    return <div className="flex items-center gap-0.5 text-lg">{starsHTML}</div>;
  };

  return (
    <div className="flex flex-col gap-6 max-w-[600px] mx-auto w-full">
      <Link to="/admin/reviews" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-light text-warning-ink flex items-center justify-center font-bold text-lg">
              ★
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-heading">Chi tiết đánh giá của du khách</h3>
                <StatusBadge domain="review" status={r.TrangThai} />
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Booking: <strong className="font-mono">{r.DAT_PHONG.MaXacNhanDatPhong}</strong> • {formatDateRangeVi(r.DAT_PHONG.NgayNhanPhong, r.DAT_PHONG.NgayTraPhong, ' → ')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {moderateMutation.isError && (
             <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
               {moderateMutation.error instanceof ApiError ? moderateMutation.error.message : 'Không thể cập nhật trạng thái'}
             </div>
          )}
          {removeMutation.isError && (
             <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
               {removeMutation.error instanceof ApiError ? removeMutation.error.message : 'Không thể gỡ đánh giá'}
             </div>
          )}
          {removeMutation.isSuccess && (
             <div role="status" className="p-3 bg-success-light border border-success/30 rounded-xl text-success-ink text-sm font-medium">
               Đánh giá đã được gỡ khỏi phần hiển thị công khai; dữ liệu và ảnh vẫn được lưu để kiểm tra.
             </div>
          )}

          <div className="flex items-center justify-between p-3.5 bg-surface-secondary rounded-xl border border-border/60">
            <div>
              <div className="font-bold text-heading text-sm">{r.TAI_KHOAN.HoTen} <span className="font-normal text-ink-muted text-xs">({r.TAI_KHOAN.Email})</span></div>
              <div className="text-[11px] text-ink-muted mt-1">Khách sạn: <strong className="text-ink-sub">{r.KHACH_SAN.TenKhachSan}</strong></div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {renderStars(r.DiemDanhGia)}
              <span className="font-bold text-warning tracking-wider text-sm">{r.DiemDanhGia}.0 / 5</span>
            </div>
          </div>

          <div>
            <p className="block font-semibold text-ink-sub mb-1.5 text-[11px] uppercase tracking-wider">Nội dung đánh giá:</p>
            <div className="p-4 bg-white border border-border rounded-xl text-ink-sub leading-relaxed font-medium text-sm whitespace-pre-wrap shadow-sm">
              {r.NoiDung || <span className="text-ink-muted italic">Không có nội dung bình luận</span>}
            </div>
          </div>

          {r.HINH_ANH_DANH_GIA.length > 0 && (
            <div>
              <p className="block font-semibold text-ink-sub mb-1.5 text-[11px] uppercase tracking-wider">Hình ảnh đính kèm:</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {r.HINH_ANH_DANH_GIA.map((img, index) => (
                  <a key={img.MaHinhAnhDanhGia} href={img.URL} target="_blank" rel="noreferrer" aria-label={`Mở ảnh ${index + 1} của đánh giá tại ${r.KHACH_SAN.TenKhachSan} trong tab mới`} className="block aspect-square rounded-xl overflow-hidden border border-border shadow-sm hover:opacity-90 transition">
                    <img src={img.URL} alt={`Ảnh ${index + 1} trong đánh giá của ${r.TAI_KHOAN.HoTen} về ${r.KHACH_SAN.TenKhachSan}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {r.TrangThai === 'Vi phạm' && (
            <div className="p-4 bg-danger-light border border-danger/30 rounded-xl text-danger-ink space-y-1 shadow-sm">
              <strong className="font-bold flex items-center gap-1.5 text-danger-ink text-sm">
                <i className="ph-fill ph-warning-circle text-lg"></i>
                Đánh giá có dấu hiệu vi phạm
              </strong>
              <p className="text-[11px] leading-relaxed text-danger-ink/80">
                Cần kiểm duyệt kỹ nội dung và hình ảnh. Có thể gỡ khỏi hệ thống hiển thị công khai.
              </p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border bg-surface-secondary flex flex-col sm:flex-row items-center justify-end gap-3">
          {r.TrangThai !== 'Hiển thị' && (
            <Button
              disabled={moderateMutation.isPending || removeMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: reviewId, trangThai: 'Hiển thị' })} variant="success" className="w-full sm:w-auto"
            >
              {r.TrangThai === 'Chờ duyệt' ? 'Cho hiển thị' : 'Hiển thị lại'}
            </Button>
          )}
          
          {r.TrangThai !== 'Ẩn' && (
            <Button
              disabled={moderateMutation.isPending || removeMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: reviewId, trangThai: 'Ẩn' })} variant="outline" className="w-full sm:w-auto"
            >
              Ẩn đánh giá
            </Button>
          )}

          {r.TrangThai !== 'Vi phạm' && (
            <Button
              disabled={moderateMutation.isPending || removeMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: reviewId, trangThai: 'Vi phạm' })} variant="danger-outline" className="w-full sm:w-auto"
            >
              Đánh dấu vi phạm
            </Button>
          )}
          
          {(r.TrangThai === 'Vi phạm' || r.TrangThai === 'Ẩn') && (
            <Button
              disabled={r.TrangThai === 'Ẩn' || removeMutation.isPending}
              onClick={() => { void confirm({ title: 'Gỡ đánh giá khỏi phần công khai?', description: 'Dữ liệu và ảnh vẫn được lưu để phục vụ kiểm tra.', confirmLabel: 'Gỡ đánh giá', variant: 'danger' }).then((accepted) => { if (accepted) removeMutation.mutate(reviewId); }); }} variant="danger" className="w-full sm:w-auto"
            >
              {removeMutation.isPending ? 'Đang gỡ...' : r.TrangThai === 'Ẩn' ? 'Đã gỡ' : 'Xóa / gỡ khỏi công khai'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
