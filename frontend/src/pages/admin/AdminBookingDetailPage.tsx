import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import { getAdminBooking } from '../../features/admin/bookings/api';
import { formatCurrencyVND, formatDateTimeVi, formatDateVi } from '../../lib/utils';
import { Icon } from '../../components/common/Icon';
import { PageSpinner } from '../../components/common/PageSpinner';
import { StatusBadge } from '../../components/domain/StatusBadge';

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-[11px] font-semibold text-ink-muted">{label}</dt><dd className="mt-1 font-semibold text-heading">{children}</dd></div>;
}

export default function AdminBookingDetailPage() {
  const id = Number(useParams().id);
  const query = useQuery({
    queryKey: ['admin', 'bookings', id],
    queryFn: () => getAdminBooking(id),
    enabled: Number.isInteger(id) && id > 0,
  });

  if (query.isLoading) return <PageSpinner />;
  if (query.isError || !query.data) {
    return <div role="alert" className="mx-auto max-w-md rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-center text-sm text-danger-ink">{query.error instanceof ApiError ? query.error.message : 'Không tìm thấy đặt phòng'}</div>;
  }

  const booking = query.data;
  const totalRooms = booking.ChiTietPhong.reduce((sum, room) => sum + room.SoLuong, 0);

  return (
    <div className="admin-booking-detail mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <Link to="/admin/bookings" className="breadcrumb w-fit"><Icon name="arrow-left" /><span>Quay lại danh sách đặt phòng</span></Link>

      <article className="overflow-hidden rounded-[16px] border border-border bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-secondary px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-100 text-primary-700"><Icon name="calendar-check" size={22} weight="fill" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-lg font-bold text-heading">#{booking.MaXacNhanDatPhong}</h1>
                <StatusBadge domain="booking" status={booking.TrangThai} />
              </div>
              <p className="mt-0.5 text-[11px] text-ink-muted">Tạo lúc {formatDateTimeVi(booking.NgayTao)} · cập nhật {formatDateTimeVi(booking.NgayCapNhat)}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-[11px] font-semibold text-ink-muted">Tổng thanh toán</span>
            <strong className="text-xl text-heading">{formatCurrencyVND(booking.TongTienThanhToan)}</strong>
          </div>
        </header>

        <div className="grid gap-5 p-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface-secondary p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-heading"><Icon name="buildings" className="text-primary" />Khách sạn và khách hàng</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="Khách sạn"><Link to={`/admin/hotels/${booking.KhachSan.MaKhachSan}`} className="text-primary hover:underline">{booking.KhachSan.TenKhachSan}</Link></InfoItem>
              <InfoItem label="Mã khách sạn">#{booking.KhachSan.MaKhachSan}</InfoItem>
              <InfoItem label="Khách hàng"><Link to={`/admin/accounts/${booking.KhachHang.MaTaiKhoan}`} className="text-primary hover:underline">{booking.KhachHang.HoTen}</Link></InfoItem>
              <InfoItem label="Số điện thoại"><a href={`tel:${booking.KhachHang.SoDienThoai}`} className="hover:text-primary">{booking.KhachHang.SoDienThoai}</a></InfoItem>
              <div className="sm:col-span-2"><InfoItem label="Địa chỉ khách sạn">{booking.KhachSan.DiaChiChiTiet}</InfoItem></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-surface-secondary p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-heading"><Icon name="calendar-dots" className="text-primary" />Lịch lưu trú</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoItem label="Ngày nhận phòng">{formatDateVi(booking.NgayNhanPhong)} · {booking.KhachSan.GioNhanPhong}</InfoItem>
              <InfoItem label="Ngày trả phòng">{formatDateVi(booking.NgayTraPhong)} · {booking.KhachSan.GioTraPhong}</InfoItem>
              <InfoItem label="Tổng số phòng">{totalRooms} phòng</InfoItem>
              <InfoItem label="Số loại phòng">{booking.ChiTietPhong.length} loại</InfoItem>
            </dl>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {booking.ChiTietPhong.map((room) => (
                <div key={room.MaLoaiPhong} className="flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5">
                  <span className="font-semibold text-heading">{room.TenLoaiPhong}</span>
                  <span className="admin-neutral-tag">{room.SoLuong} phòng</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-heading"><Icon name="receipt" className="text-primary" />Giá trị đặt phòng</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Tiền phòng</dt><dd className="font-semibold text-heading">{formatCurrencyVND(booking.TongTienPhong)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-muted">Khuyến mãi{booking.KhuyenMai ? ` (${booking.KhuyenMai.MaCode})` : ''}</dt><dd className="font-semibold text-success-ink">− {formatCurrencyVND(booking.SoTienGiam)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-border pt-3"><dt className="font-bold text-heading">Tổng thanh toán</dt><dd className="text-base font-extrabold text-primary">{formatCurrencyVND(booking.TongTienThanhToan)}</dd></div>
            </dl>
            {booking.GhiChu && <div className="mt-4 rounded-xl border border-warning/30 bg-warning-light p-3 text-sm text-warning-ink"><strong className="block text-xs">Ghi chú của khách</strong><p className="mt-1 whitespace-pre-wrap">{booking.GhiChu}</p></div>}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-heading"><Icon name="shield-check" className="text-primary" />Chính sách hủy</h2>
            <strong className="text-heading">{booking.ChinhSachHuy.TenChinhSach}</strong>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{booking.ChinhSachHuy.MoTa}</p>
            {booking.ChinhSachHuy.ChiTiet.length > 0 && (
              <ul className="mt-3 space-y-2">
                {booking.ChinhSachHuy.ChiTiet.map((tier) => <li key={tier.SoGioTruocNhanPhong} className="flex justify-between rounded-lg bg-surface-secondary px-3 py-2 text-sm"><span>Trước {tier.SoGioTruocNhanPhong} giờ</span><strong>Hoàn {tier.TyLeHoanTien}%</strong></li>)}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-heading"><Icon name="credit-card" className="text-primary" />Thanh toán và hoàn tiền</h2>
            {booking.ThanhToan.length === 0 ? (
              <p className="rounded-xl bg-surface-secondary px-4 py-3 text-sm text-ink-muted">Đặt phòng chưa có giao dịch thanh toán.</p>
            ) : (
              <div className="space-y-3">
                {booking.ThanhToan.map((payment) => (
                  <div key={payment.MaThanhToan} className="rounded-xl border border-border bg-surface-secondary p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link to={`/admin/payments/${payment.MaThanhToan}`} className="font-mono font-bold text-primary hover:underline">{payment.MaGiaoDichDoiTac || `PAY-${payment.MaThanhToan}`}</Link>
                        <p className="mt-1 text-[11px] text-ink-muted">{payment.PhuongThucThanhToan} · {formatDateTimeVi(payment.ThoiGianGiaoDich)}</p>
                      </div>
                      <div className="flex items-center gap-3"><strong className="text-heading">{formatCurrencyVND(payment.SoTien)}</strong><StatusBadge domain="payment" status={payment.TrangThai} /></div>
                    </div>
                    {payment.HoanTien.map((refund) => (
                      <div key={refund.MaHoanTien} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                        <div><span className="font-semibold text-ink-sub">Hoàn {formatCurrencyVND(refund.SoTienHoan)}</span><p className="text-[11px] text-ink-muted">{refund.LyDoHoanTien} · {formatDateTimeVi(refund.NgayYeuCau)}</p></div>
                        <StatusBadge domain="refund" status={refund.TrangThai} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
