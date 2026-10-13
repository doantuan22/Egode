import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { ROLE_NAMES } from '../lib/roles';

const ProfilePage = lazy(() => import('../pages/customer/ProfilePage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminAnalyticsPage = lazy(() => import('../pages/admin/AdminAnalyticsPage'));
const AdminPromotionsPage = lazy(() => import('../pages/admin/AdminPromotionsPage'));
const AdminPromotionFormPage = lazy(() => import('../pages/admin/AdminPromotionFormPage'));
const AdminAccountsPage = lazy(() => import('../pages/admin/AdminAccountsPage'));
const AdminAccountDetailPage = lazy(() => import('../pages/admin/AdminAccountDetailPage'));
const AdminCreateAccountPage = lazy(() => import('../pages/admin/AdminCreateAccountPage'));
const AdminHotelsPage = lazy(() => import('../pages/admin/AdminHotelsPage'));
const AdminHotelDetailPage = lazy(() => import('../pages/admin/AdminHotelDetailPage'));
const AdminBookingsPage = lazy(() => import('../pages/admin/AdminBookingsPage'));
const AdminBookingDetailPage = lazy(() => import('../pages/admin/AdminBookingDetailPage'));
const AdminPaymentsPage = lazy(() => import('../pages/admin/AdminPaymentsPage'));
const AdminPaymentDetailPage = lazy(() => import('../pages/admin/AdminPaymentDetailPage'));
const AdminReviewsPage = lazy(() => import('../pages/admin/AdminReviewsPage'));
const AdminReviewDetailPage = lazy(() => import('../pages/admin/AdminReviewDetailPage'));
const AdminSupportPage = lazy(() => import('../pages/admin/AdminSupportPage'));
const AdminSupportDetailPage = lazy(() => import('../pages/admin/AdminSupportDetailPage'));
const AdminPartnerApplicationsPage = lazy(() => import('../pages/admin/AdminPartnerApplicationsPage'));
const AdminPartnerApplicationDetailPage = lazy(() => import('../pages/admin/AdminPartnerApplicationDetailPage'));

/** Quản trị hệ thống. */
export const adminRoutes = (
  <Route element={<ProtectedRoute allowedRoles={[ROLE_NAMES.ADMIN]} />}>
    <Route path="/admin" element={<AdminDashboardPage />} />
    <Route path="/admin/profile" element={<ProfilePage />} />
    <Route path="/admin/accounts" element={<AdminAccountsPage />} />
    <Route path="/admin/accounts/new" element={<AdminCreateAccountPage />} />
    <Route path="/admin/accounts/:id" element={<AdminAccountDetailPage />} />
    <Route path="/admin/hotels" element={<AdminHotelsPage />} />
    <Route path="/admin/hotels/:id" element={<AdminHotelDetailPage />} />
    <Route path="/admin/bookings" element={<AdminBookingsPage />} />
    <Route path="/admin/bookings/:id" element={<AdminBookingDetailPage />} />
    <Route path="/admin/payments" element={<AdminPaymentsPage />} />
    <Route path="/admin/payments/:id" element={<AdminPaymentDetailPage />} />
    <Route path="/admin/reviews" element={<AdminReviewsPage />} />
    <Route path="/admin/reviews/:id" element={<AdminReviewDetailPage />} />
    <Route path="/admin/support" element={<AdminSupportPage />} />
    <Route path="/admin/support/:id" element={<AdminSupportDetailPage />} />
    <Route path="/admin/partner-applications" element={<AdminPartnerApplicationsPage />} />
    <Route path="/admin/partner-applications/:id" element={<AdminPartnerApplicationDetailPage />} />
    <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
    <Route path="/admin/promotions" element={<AdminPromotionsPage />} />
    <Route path="/admin/promotions/new" element={<AdminPromotionFormPage />} />
    <Route path="/admin/promotions/:id" element={<AdminPromotionFormPage />} />
  </Route>
);
