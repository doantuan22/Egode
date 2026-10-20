import { Button } from '../../common/Button';

interface MobileBookingBarProps {
  roomCount: number;
  /** Tổng tiền đã định dạng hoặc trạng thái */
  total: string;
  onOpenPanel: () => void;
}

/** Tóm tắt phòng đã chọn cố định trên điện thoại */
export function MobileBookingBar({ roomCount, total, onOpenPanel }: MobileBookingBarProps) {
  return (
    <div className="hotel-mobile-bar lg:hidden" role="region" aria-label="Tóm tắt lựa chọn phòng">
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{roomCount} phòng</p>
        <p className="truncate text-base font-bold text-ink">{total}</p>
      </div>
      <Button type="button" className="shrink-0" onClick={onOpenPanel}>Xem chi tiết & đặt phòng</Button>
    </div>
  );
}
