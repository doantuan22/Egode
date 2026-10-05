import { Link, useParams } from 'react-router-dom';
import { useOwnerBooking } from '../../features/owner/hooks';
import { OwnerHotelContextSelector, OwnerHotelScopeState } from '../../components/owner/OwnerHotelContext';
import { useOwnerHotelContext } from '../../features/owner/context';
import { formatCurrencyVND, formatDateVi, formatDateTimeVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { BOOKING_STATUS } from '../../features/bookings/status';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

export default function OwnerBookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const scope = useOwnerHotelContext();
  const hotelId = scope.hotelId ?? 0;
  const booking = useOwnerBooking(hotelId, Number(bookingId));
  
  if (scope.hotelsQuery.isLoading || (hotelId > 0 && booking.isLoading)) {
    return <PageSpinner />;
  }
  
  if (scope.hotelsQuery.isError || (hotelId > 0 && (booking.isError || !booking.data))) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink border border-danger/30">
        {booking.error instanceof ApiError ? booking.error.message : 'Không tìm thấy booking'}
      </div>
    );
  }
  
  const b = booking.data;

  if (!hotelId || !b) return <div className="owner-module space-y-5"><header className="owner-module__header"><div><h1>Chi tiết đặt phòng</h1><p>Chi tiết thuộc phạm vi khách sạn đã chọn.</p></div></header><OwnerHotelContextSelector hotels={scope.hotels} hotelId={scope.hotelId} onChange={scope.selectHotel} /><OwnerHotelScopeState loading={false} error={scope.hotelsQuery.error} empty={scope.hotels.length === 0} invalid={scope.invalidHotelId} />{scope.hotels.length > 1 && !hotelId && <div className="owner-scope-state">Chọn khách sạn để tiếp tục.</div>}</div>;

  return (
    <div className="owner-module flex flex-col gap-6 max-w-[800px] mx-auto w-full">
      <Link to={`/owner/bookings?hotelId=${hotelId}`} className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách booking</span>
      </Link>
      <OwnerHotelContextSelector hotels={scope.hotels} hotelId={scope.hotelId} onChange={scope.selectHotel} />

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              <i className="ph-fill ph-ticket text-[20px]"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-ink">#{b.MaXacNhanDatPhong}</h3>
                <StatusBadge domain="booking" status={b.TrangThai} />
              </div>
              <p className="text-xs text-ink-muted mt-0.5">Ngày tạo: {formatDateTimeVi(b.NgayTao)}</p>
            </div>
          </div>
          <Button type="button" onClick={() => window.print()} variant="outline">
            <i className="ph ph-printer"></i> In phiếu
          </Button>
        </div>

        {/* Auto Confirm Notification Banner */}
        {(b.TrangThai === BOOKING_STATUS.CONFIRMED || b.TrangThai === BOOKING_STATUS.COMPLETED) && (
          <div className="bg-primary-50/80 px-6 py-3 border-b border-primary-100 flex items-start gap-2.5">
            <i className="ph-fill ph-info text-primary mt-0.5"></i>
            <p className="text-xs text-primary-800 leading-relaxed font-medium">
              Đơn đặt phòng này đã được <strong className="text-primary-700">hệ thống Egode tự động xác nhận</strong>. Khách sạn không cần thao tác duyệt đơn thủ công.
            </p>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* 1. Thông tin khách hàng */}
          <div className="bg-white border border-border rounded-2xl p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <i className="ph-fill ph-user text-primary"></i> Thông tin khách hàng
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-ink-muted block">Họ và tên khách:</span>
                <span className="font-bold text-ink">{b.KhachHang.HoTen}</span>
              </div>
              <div>
                <span className="text-xs text-ink-muted block">Số điện thoại liên hệ:</span>
                <a href={`tel:${b.KhachHang.SoDienThoai}`} className="font-semibold text-ink hover:text-primary">{b.KhachHang.SoDienThoai}</a>
              </div>
            </div>
          </div>

          {/* 2. Thông tin phòng & Lịch lưu trú */}
          <div className="bg-white border border-border rounded-2xl p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <i className="ph-fill ph-bed text-primary"></i> Chi tiết phòng & Thời gian lưu trú
              </h4>
              <span className="text-xs font-semibold text-primary">
                {Math.ceil((new Date(b.NgayTraPhong).getTime() - new Date(b.NgayNhanPhong).getTime()) / (1000 * 3600 * 24))} đêm
              </span>
            </div>
            
            {b.ChiTietPhong.map(room => (
              <div key={room.MaLoaiPhong} className="bg-surface-secondary p-3.5 rounded-xl flex items-center justify-between mb-2">
                <div>
                  <h5 className="font-bold text-ink text-sm">{room.TenLoaiPhong}</h5>
                  <p className="text-xs text-ink-muted mt-0.5">{room.SoLuong} phòng</p>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 border border-border rounded-xl bg-surface-secondary/50">
                <div className="text-[11px] uppercase font-bold text-ink-muted">Nhận phòng (Check-in)</div>
                <div className="font-bold text-ink text-sm mt-0.5">{formatDateVi(b.NgayNhanPhong)}</div>
                <div className="text-[11px] text-ink-muted">Từ {b.GioNhanPhong}</div>
              </div>
              <div className="p-3 border border-border rounded-xl bg-surface-secondary/50">
                <div className="text-[11px] uppercase font-bold text-ink-muted">Trả phòng (Check-out)</div>
                <div className="font-bold text-ink text-sm mt-0.5">{formatDateVi(b.NgayTraPhong)}</div>
                <div className="text-[11px] text-ink-muted">Trước {b.GioTraPhong}</div>
              </div>
            </div>
          </div>

          {/* 3. Ghi chú (nếu có) */}
          {b.GhiChu && (
            <div className="bg-white border border-border rounded-2xl p-4.5 shadow-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <i className="ph-fill ph-warning-circle text-warning"></i> Yêu cầu đặc biệt từ khách
              </h4>
              <div className="p-3 bg-warning-light/50 border border-warning/60 rounded-xl text-xs text-warning-ink leading-relaxed font-medium">
                "{b.GhiChu}"
              </div>
            </div>
          )}

          {/* 4. Hóa đơn & Trạng thái thanh toán */}
          <div className="bg-white border border-border rounded-2xl p-4.5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <i className="ph-fill ph-currency-circle-dollar text-success"></i> Chi tiết thanh toán
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="pt-2.5 flex justify-between items-baseline">
                <span className="text-sm font-bold text-ink">Tổng số tiền cần thu:</span>
                <span className="text-lg font-extrabold text-primary-700">{formatCurrencyVND(b.TongTienThanhToan)}</span>
              </div>
            </div>

            {b.ThanhToan.map((p) => (
              <div key={p.MaThanhToan} className="mt-3 p-3 bg-surface-secondary rounded-xl border border-border text-[11px] text-ink-muted space-y-1">
                <div className="flex justify-between">
                  <span>Phương thức:</span>
                  <strong className="text-ink-sub">{p.PhuongThucThanhToan}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Số tiền:</span>
                  <strong className="text-ink-sub">{formatCurrencyVND(p.SoTien)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Trạng thái giao dịch:</span>
                  <span className={`font-semibold ${p.TrangThai === 'Thành công' ? 'text-success' : p.TrangThai === 'Thất bại' ? 'text-danger' : 'text-warning-ink'}`}>
                    {p.TrangThai}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
