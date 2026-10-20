import { Route } from 'react-router-dom';
import { RedirectAlias } from './RedirectAlias';

/** URL cũ chuyển hướng về route chuẩn */
export const ROUTE_ALIASES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['/home', '/'],
  ['/search-results', '/hotels'],
  ['/hotel-detail/:id', '/hotels/:id'],
  ['/account-profile', '/profile'],
  ['/register-partner', '/partner/apply'],
  ['/my-bookings', '/bookings'],
  ['/booking-detail/:id', '/bookings/:id'],
  ['/payment-result', '/payment/result'],
  ['/support-request', '/support'],
  ['/admin/onboarding', '/admin/partner-applications'],
  ['/admin/operations', '/admin'],
  // Chuỗi đặt phòng cũ đã bỏ, đơn được xem và thanh toán ở trang chi tiết
  ['/booking/:id/room', '/bookings/:id'],
  ['/booking/:id/confirm', '/bookings/:id'],
  ['/booking/:id/payment', '/bookings/:id'],
  ['/payment/:id', '/bookings/:id'],
  // Trang đánh giá cũ đã bỏ
  ['/write-review/:id', '/bookings/:id#danh-gia'],
];

/** Mỗi alias một Route */
export function aliasRoutes() {
  return ROUTE_ALIASES.map(([from, to]) => <Route key={from} path={from} element={<RedirectAlias to={to} />} />);
}
