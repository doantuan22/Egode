import type { UseQueryResult } from '@tanstack/react-query';
import type { Quote } from '../../../features/quotes/types';
import { ApiError } from '../../../services/apiClient';
import { cn, formatCurrencyVND } from '../../../lib/utils';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Icon } from '../../common/Icon';
import { Input } from '../../common/Input';
import { PageSpinner } from '../../common/PageSpinner';
import { Textarea } from '../../common/Textarea';

export interface BookingPanelProps {
  roomTypeCount: number;
  roomCount: number;
  quoteQuery: UseQueryResult<Quote>;
  /** The quote on screen was made for the rooms and dates currently selected. */
  quoteMatchesSelection: boolean;
  /** The promo code typed is the one the quote was made with. */
  quoteMatchesPromo: boolean;
  promoCode: string;
  onPromoCodeChange: (value: string) => void;
  onApplyPromo: () => void;
  note: string;
  onNoteChange: (value: string) => void;
  bookingError: unknown;
  isBooking: boolean;
  isSignedIn: boolean;
  isCustomer: boolean;
  onSignIn: () => void;
  onBook: () => void;
}

/** Presentation only: the quote, the booking request and the promo code are decided by the page. */
export function BookingPanel(props: BookingPanelProps) {
  const { roomTypeCount, roomCount, quoteQuery, quoteMatchesSelection } = props;
  const quote = quoteQuery.data;

  return (
    <div id="dat-phong" className="hotel-selection-summary scroll-mt-36 lg:sticky lg:top-40 space-y-4">
      <Card raised className="p-6">
        <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <Icon name="receipt" weight="fill" size={20} className="text-primary" />
          Chi tiết đặt phòng
        </h2>

        {roomTypeCount === 0 ? (
          <div className="p-4 bg-primary-50 rounded-xl text-center">
            <Icon name="hand-pointing" weight="duotone" size={30} className="text-primary mb-2" />
            <p className="text-sm font-medium text-primary-800">Chọn số lượng cho một hoặc nhiều loại phòng để xem tổng giá.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3 text-sm">
              <span className="font-semibold text-ink">{roomTypeCount} loại phòng</span>
              <span className="text-ink-muted">{roomCount} phòng</span>
            </div>

            {quoteQuery.isLoading ? (
              <PageSpinner className="py-6" />
            ) : quoteQuery.isError ? (
              <div role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger-ink">
                {quoteQuery.error instanceof ApiError ? quoteQuery.error.message : 'Lỗi tạo báo giá'}
              </div>
            ) : !quoteMatchesSelection ? (
              <div className="flex justify-center py-6 text-sm text-ink-muted" role="status" aria-live="polite">Đang cập nhật báo giá...</div>
            ) : quote ? (
              <QuoteDetails quote={quote} {...props} />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function QuoteDetails({ quote, quoteQuery, quoteMatchesPromo, promoCode, onPromoCodeChange, onApplyPromo, note, onNoteChange, bookingError, isBooking, isSignedIn, isCustomer, onSignIn, onBook }: BookingPanelProps & { quote: Quote }) {
  return (
    <>
      {!quote.KhaDung && (
        <div className="rounded-lg bg-warning-light px-3 py-2 text-xs text-warning-ink">
          Một hoặc nhiều loại phòng không đủ số lượng hoặc chưa có giá cho toàn bộ ngày lưu trú.
        </div>
      )}

      <div className="space-y-3 border-b border-border pb-3 text-sm">
        {quote.ChiTietPhong.map((line) => (
          <div key={line.MaLoaiPhong} className="space-y-1">
            <div className="flex justify-between gap-3 font-semibold text-ink">
              <span>{line.TenLoaiPhong}</span>
              <span className="shrink-0">{formatCurrencyVND(line.ThanhTien ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3 text-xs text-ink-muted">
              <span>{line.SoLuongYeuCau} phòng × {quote.SoDem} đêm</span>
              <span>{line.GiaTheoDem !== null ? formatCurrencyVND(line.GiaTheoDem) + '/phòng/đêm' : 'Chưa có giá'}</span>
            </div>
            {!line.DuPhong && <p className="text-xs text-warning-ink">Chỉ còn {line.SoPhongConLai} phòng cho loại này.</p>}
            {!line.CoGiaDayDu && <p className="text-xs text-warning-ink">Thiếu giá cho một hoặc nhiều ngày trong kỳ lưu trú.</p>}
          </div>
        ))}
      </div>
      <div className="space-y-2 border-b border-border pb-3 text-sm">
        <div className="flex justify-between font-bold text-ink">
          <span>Tổng tiền phòng</span>
          <span>{formatCurrencyVND(quote.TongTienPhong)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              id="hotel-detail-ml-1"
              label="Mã khuyến mãi"
              type="text"
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value)}
              placeholder="Nhập mã (nếu có)"
              className="uppercase"
            />
          </div>
          <Button type="button" variant="secondary" onClick={onApplyPromo} disabled={!promoCode.trim() || quoteQuery.isFetching}>Áp dụng</Button>
        </div>
        {!quoteMatchesPromo && <p className="text-xs text-warning-ink">Áp dụng mã để cập nhật báo giá trước khi tiếp tục.</p>}
        {quote.PromoThongBao && quoteMatchesPromo && (
          <p className={cn('text-xs font-medium', quote.PromoHopLe ? 'text-success-ink' : 'text-danger-ink')}>{quote.PromoThongBao}</p>
        )}
      </div>

      {quote.PromoHopLe && (
        <div className="flex justify-between text-sm text-success-ink font-bold bg-success-light p-2 rounded-lg">
          <span>Khuyến mãi giảm</span>
          <span>−{formatCurrencyVND(quote.SoTienGiam)}</span>
        </div>
      )}

      <div className="bg-primary-50 p-4 rounded-xl border border-primary-200 mt-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-ink">Tổng thanh toán</span>
          <div className="text-right">
            <span className="text-2xl font-black text-primary leading-none block">{formatCurrencyVND(quote.TongTienThanhToan)}</span>
            <span className="text-[10px] text-primary/70 font-semibold uppercase">Đã bao gồm thuế phí</span>
          </div>
        </div>
      </div>

      <Textarea id="hotel-detail-field-2" label="Ghi chú cho khách sạn" rows={2} value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="Ví dụ: đến muộn..." className="text-sm" />

      {Boolean(bookingError) && (
        <div role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-xs text-danger-ink">
          {bookingError instanceof ApiError ? bookingError.message : 'Lỗi'}
        </div>
      )}

      <div className="pt-2">
        {!isSignedIn ? (
          <Button type="button" size="lg" className="w-full" onClick={onSignIn}>Đăng nhập để đặt phòng</Button>
        ) : !isCustomer ? (
          <div className="text-center">
            <Button type="button" size="lg" className="w-full" disabled>Xác nhận đặt phòng</Button>
            <p className="text-[11px] text-ink-muted mt-2">Dành cho tài khoản khách hàng</p>
          </div>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={onBook}
            loading={isBooking}
            disabled={!quoteMatchesPromo || !quote.KhaDung || quoteQuery.isFetching}
          >
            {isBooking ? 'Đang xử lý...' : <><span>{quote.TongTienThanhToan === 0 ? 'Xác nhận đặt phòng' : 'Tạo đặt phòng'}</span><Icon name="arrow-right" weight="bold" /></>}
          </Button>
        )}
        {isSignedIn && isCustomer && quote.TongTienThanhToan === 0 && (
          <p className="mt-2 text-center text-[11px] text-ink-muted">Tổng thanh toán 0 đ — đặt phòng được xác nhận ngay, không cần thanh toán.</p>
        )}
      </div>

      {quote.ChinhSachHuy && (
        <div className="mt-4 p-3 bg-success-light rounded-xl">
          <div className="flex items-center gap-2 text-success-ink font-bold text-xs mb-1">
            <Icon name="shield-check" weight="fill" />
            {quote.ChinhSachHuy.TenChinhSach}
          </div>
          <ul className="text-[11px] text-success-ink pl-6 list-disc">
            {quote.ChinhSachHuy.ChiTiet.map((tier, i) => (
              <li key={i}>Hủy trước {tier.SoGioTruocNhanPhong}h hoàn {tier.TyLeHoanTien}%</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
