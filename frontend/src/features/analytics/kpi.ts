import { addDaysToDateKey, businessToday } from '../../lib/stayDates';
import type { DateRangeQuery, OwnerAnalytics } from './types';

export interface PeriodRanges {
  current: Required<DateRangeQuery>;
  previous: Required<DateRangeQuery>;
}

/** Khoảng N ngày gần nhất và N ngày ngay trước đó */
export function lastDaysRanges(days: number, today: string = businessToday()): PeriodRanges {
  return {
    current: { from: addDaysToDateKey(today, -(days - 1)), to: today },
    previous: { from: addDaysToDateKey(today, -(2 * days - 1)), to: addDaysToDateKey(today, -days) },
  };
}

export interface Kpis {
  /** Phần trăm đêm phòng đã bán */
  occupancy: number | null;
  /** Giá trung bình mỗi đêm phòng đã bán */
  adr: number | null;
  /** Doanh thu trên mỗi đêm phòng có sẵn */
  revpar: number | null;
  newBookings: number;
}

/** ADR và RevPAR chỉ là ước tính */
export function computeKpis(analytics: OwnerAnalytics): Kpis {
  const { TyLeLapDay, DoanhThuThucNhan, TongPhongDem, TongPhongCoTheBan, TongSoBooking } = analytics;
  return {
    occupancy: TyLeLapDay,
    adr: TongPhongDem > 0 ? DoanhThuThucNhan / TongPhongDem : null,
    revpar: TongPhongCoTheBan > 0 ? DoanhThuThucNhan / TongPhongCoTheBan : null,
    newBookings: TongSoBooking,
  };
}

export interface Change {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Math.abs(value));

/** Văn bản thay đổi của chỉ số so với kỳ trước */
export function changeVersusPrevious(current: number | null, previous: number | null, kind: 'percent' | 'points', label: string): Change | null {
  if (current === null || previous === null) return null;
  if (kind === 'percent' && previous === 0) return null;
  const delta = kind === 'percent' ? ((current - previous) / previous) * 100 : current - previous;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return { text: `Không đổi so với ${label}`, tone: 'neutral' };
  const sign = rounded > 0 ? '+' : '−';
  const unit = kind === 'percent' ? '%' : ' điểm %';
  return { text: `${sign}${formatNumber(rounded)}${unit} so với ${label}`, tone: rounded > 0 ? 'good' : 'bad' };
}
