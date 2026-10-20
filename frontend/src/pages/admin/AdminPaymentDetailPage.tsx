import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import { getAdminPayment } from '../../features/admin/payments/api';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { formatDateTimeVi } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';

export default function AdminPaymentDetailPage() {
  const id = Number(useParams().id);
  const query = useQuery({ queryKey: ['admin', 'payments', id], queryFn: () => getAdminPayment(id) });

  if (query.isLoading) {
    return <PageSpinner />;
  }

  if (query.isError || !query.data) {
    return <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">{query.error instanceof ApiError ? query.error.message : 'Không tìm thấy giao dịch'}</div>;
  }

  const payment = query.data;

  return (
    <div className="admin-payment-detail flex flex-col gap-5 max-w-[1000px] mx-auto w-full">
      <Link to="/admin/payments" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden flex flex-col">
        {/* Phần đầu trang */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
              <i className="ph-fill ph-credit-card"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-heading">
                  {payment.MaGiaoDichDoiTac || `PAY-${payment.MaThanhToan}`}
                </h3>
                <StatusBadge domain="payment" status={payment.TrangThai} />
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Booking: <strong className="font-mono">#{payment.DAT_PHONG.MaXacNhanDatPhong}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="admin-payment-detail__body p-6 text-xs">
          {/* Thông tin số tiền */}
          <section className="admin-payment-detail__summary space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted font-semibold text-sm">Tổng giá trị giao dịch:</span>
              <span className="text-xl font-black text-heading">{Number(payment.SoTien).toLocaleString('vi-VN')} đ</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border mt-1">
              <div>
                <span className="text-ink-muted block text-[11px] mb-0.5">Khách hàng thanh toán:</span>
                <strong className="text-heading text-sm">{payment.DAT_PHONG.TAI_KHOAN.HoTen}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px] mb-0.5">Cổng thanh toán:</span>
                <strong className="text-heading text-sm">{payment.PhuongThucThanhToan}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px] mb-0.5">Mã tham chiếu đối tác (Bank Ref):</span>
                <span className="font-mono text-ink-sub font-bold">{payment.MaGiaoDichDoiTac || 'N/A'}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px] mb-0.5">Cơ sở lưu trú thụ hưởng:</span>
                <span className="font-medium text-ink-sub">{payment.DAT_PHONG.KHACH_SAN.TenKhachSan}</span>
              </div>
            </div>
          </section>

          <section className="admin-payment-detail__timeline space-y-3">
            <h4 className="font-bold text-ink-sub uppercase tracking-wider text-[11px]">Timeline dòng tiền & trạng thái</h4>
            <div className="space-y-3 pl-2 border-l-2 border-primary/30 ml-1 text-xs pt-1">
              <div className="relative">
                 <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-surface-tertiary border-2 border-white"></div>
                 <div className="pl-3">
                   <div className="font-bold text-ink-sub">Khởi tạo giao dịch (Chờ thanh toán)</div>
                   <div className="text-ink-muted text-[10px] mt-0.5">{formatDateTimeVi(payment.ThoiGianGiaoDich)}</div>
                 </div>
              </div>
              {payment.TrangThai === 'Thành công' && (
                <div className="relative">
                   <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-success border-2 border-white"></div>
                   <div className="pl-3">
                     <div className="font-bold text-success-ink">Thanh toán thành công (Webhook xác nhận)</div>
                     <div className="text-ink-muted text-[10px] mt-0.5">{formatDateTimeVi(payment.ThoiGianGiaoDich)}</div>
                   </div>
                </div>
              )}
              {payment.TrangThai === 'Thất bại' && (
                <div className="relative">
                   <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-danger border-2 border-white"></div>
                   <div className="pl-3">
                     <div className="font-bold text-danger-ink">Giao dịch thất bại / Hết thời gian</div>
                     <div className="text-ink-muted text-[10px] mt-0.5">{formatDateTimeVi(payment.ThoiGianGiaoDich)}</div>
                   </div>
                </div>
              )}
            </div>
          </section>

          {payment.HOAN_TIEN && payment.HOAN_TIEN.length > 0 && (
            <section className="admin-payment-detail__refunds space-y-3">
              {payment.HOAN_TIEN.map((refund) => (
                <div key={refund.MaHoanTien} className="border-t border-border py-4 space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-warning/60">
                    <div className="flex items-center gap-1.5 font-bold text-warning-ink text-sm">
                      <i className="ph-fill ph-arrow-u-down-left text-warning-ink"></i>
                      Thông tin hoàn tiền (Refund)
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning-light text-warning-ink">
                      {refund.TrangThai}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-warning-ink">
                    <div>
                      <span className="text-warning-ink/80 block text-[11px] mb-0.5">Số tiền hoàn trả:</span>
                      <strong className="text-danger font-black text-sm">- {Number(refund.SoTienHoan).toLocaleString('vi-VN')} đ</strong>
                    </div>
                    <div>
                      <span className="text-warning-ink/80 block text-[11px] mb-0.5">Ngày yêu cầu:</span>
                      <span className="font-medium">{refund.NgayYeuCau ? formatDateTimeVi(refund.NgayYeuCau) : ''}</span>
                    </div>
                    {refund.LyDoHoanTien && (
                      <div className="col-span-2 mt-1">
                        <span className="text-warning-ink/80 block text-[11px] mb-0.5">Lý do hoàn tiền:</span>
                        <span className="italic text-warning-ink/80 bg-white/50 px-2 py-1.5 rounded block border border-warning-light/50">{refund.LyDoHoanTien}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
