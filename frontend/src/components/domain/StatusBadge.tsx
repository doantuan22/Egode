/* Export the tone helper so unknown/open-domain mapping can be tested directly. */
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { BOOKING_STATUS } from '../../features/bookings/status';

export type StatusDomain = 'hotel' | 'roomType' | 'roomRate' | 'booking' | 'payment' | 'refund' | 'account' | 'partnerApplication' | 'promotion' | 'review' | 'support';
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const statusTones: Record<StatusDomain, Record<string, StatusTone>> = {
  hotel: { 'Hoạt động': 'success', 'Chờ duyệt': 'warning', 'Đình chỉ': 'danger', 'Từ chối': 'danger', 'Ngừng hoạt động': 'neutral' },
  roomType: { 'Hoạt động': 'success', 'Ngừng bán': 'neutral' },
  roomRate: { 'Mở bán': 'success', 'Đóng bán': 'neutral' },
  booking: { [BOOKING_STATUS.PENDING_PAYMENT]: 'warning', [BOOKING_STATUS.CONFIRMED]: 'success', [BOOKING_STATUS.CANCELLED]: 'neutral', [BOOKING_STATUS.COMPLETED]: 'success' },
  payment: { 'Chờ xử lý': 'warning', 'Thành công': 'success', 'Thất bại': 'danger' },
  refund: { 'Chờ xử lý': 'warning', 'Thành công': 'success', 'Thất bại': 'danger' },
  account: { 'Hoạt động': 'success', 'Khóa': 'danger' },
  partnerApplication: { 'Chờ duyệt': 'warning', 'Đã duyệt': 'success', 'Từ chối': 'danger' },
  promotion: { 'Hoạt động': 'success', 'Ngừng': 'neutral' },
  review: { 'Chờ duyệt': 'warning', 'Hiển thị': 'success', 'Ẩn': 'neutral', 'Vi phạm': 'danger' },
  support: { 'Mới': 'warning', 'Mới tiếp nhận': 'warning', 'Đang xử lý': 'info', 'Đã xử lý': 'success' },
};

export function getStatusTone(domain: StatusDomain, status: string): StatusTone {
  return statusTones[domain][status] ?? 'neutral';
}

export function StatusBadge({ domain, status, icon, className }: { domain: StatusDomain; status: string; icon?: ReactNode; className?: string }) {
  return <span className={cn('ui-status', `ui-status--${getStatusTone(domain, status)}`, className)}>{icon && <span aria-hidden="true">{icon}</span>}{status}</span>;
}
