import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';

const ProfilePage = lazy(() => import('../pages/customer/ProfilePage'));
const PartnerApplyPage = lazy(() => import('../pages/customer/PartnerApplyPage'));
const BookingsPage = lazy(() => import('../pages/customer/BookingsPage'));
const BookingDetailPage = lazy(() => import('../pages/customer/BookingDetailPage'));
const PaymentResultPage = lazy(() => import('../pages/customer/PaymentResultPage'));
const SupportPage = lazy(() => import('../pages/customer/SupportPage'));
const SupportDetailPage = lazy(() => import('../pages/customer/SupportDetailPage'));

/** Mọi tài khoản đã đăng nhập */
export const customerRoutes = (
  <Route element={<ProtectedRoute />}>
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/partner/apply" element={<PartnerApplyPage />} />
    <Route path="/bookings" element={<BookingsPage />} />
    <Route path="/bookings/:id" element={<BookingDetailPage />} />
    <Route path="/payment/result" element={<PaymentResultPage />} />
    <Route path="/support" element={<SupportPage />} />
    <Route path="/support/:id" element={<SupportDetailPage />} />
  </Route>
);
