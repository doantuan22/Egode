import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { ROLE_NAMES } from '../lib/roles';
import {
  LegacyOwnerBookingDetailRoute,
  LegacyOwnerHotelDetailRoute,
  LegacyOwnerHotelRoute,
  LegacyOwnerModuleRoute,
  LegacyOwnerRoomTypeRoute,
} from './OwnerRouteRedirects';

const ProfilePage = lazy(() => import('../pages/customer/ProfilePage'));
const OwnerDashboardPage = lazy(() => import('../pages/owner/OwnerDashboardPage'));
const OwnerHotelFormPage = lazy(() => import('../pages/owner/OwnerHotelFormPage'));
const OwnerHotelManagePage = lazy(() => import('../pages/owner/OwnerHotelManagePage'));
const OwnerHotelReviewsPage = lazy(() => import('../pages/owner/OwnerHotelReviewsPage'));
const OwnerRoomTypeManagePage = lazy(() => import('../pages/owner/OwnerRoomTypeManagePage'));
const OwnerBookingsPage = lazy(() => import('../pages/owner/OwnerBookingsPage'));
const OwnerBookingDetailPage = lazy(() => import('../pages/owner/OwnerBookingDetailPage'));
const OwnerRoomTypesPage = lazy(() => import('../pages/owner/OwnerRoomTypesPage'));
const OwnerInventoryPricingPage = lazy(() => import('../pages/owner/OwnerInventoryPricingPage'));
const OwnerRevenuePage = lazy(() => import('../pages/owner/OwnerRevenuePage'));
const OwnerReportsPage = lazy(() => import('../pages/owner/OwnerReportsPage'));

/** Chủ khách sạn: the owner dashboard, plus the old /partner/* and /owner/hotels/:id/* URLs as redirects. */
export const ownerRoutes = (
  <Route element={<ProtectedRoute allowedRoles={[ROLE_NAMES.PARTNER]} />}>
    <Route path="/owner" element={<LegacyOwnerModuleRoute to="/owner/overview" />} />
    <Route path="/owner/overview" element={<OwnerDashboardPage mode="overview" />} />
    <Route path="/owner/hotels" element={<OwnerDashboardPage mode="hotels" />} />
    <Route path="/owner/hotels/new" element={<OwnerHotelFormPage />} />
    <Route path="/owner/hotels/:hotelId" element={<OwnerHotelManagePage />} />
    <Route path="/owner/hotels/:hotelId/reviews" element={<OwnerHotelReviewsPage />} />
    <Route path="/owner/room-types" element={<OwnerRoomTypesPage />} />
    <Route path="/owner/room-types/:roomTypeId" element={<OwnerRoomTypeManagePage />} />
    <Route path="/owner/inventory-pricing" element={<OwnerInventoryPricingPage />} />
    <Route path="/owner/bookings" element={<OwnerBookingsPage />} />
    <Route path="/owner/bookings/:bookingId" element={<OwnerBookingDetailPage />} />
    <Route path="/owner/revenue" element={<OwnerRevenuePage />} />
    <Route path="/owner/reports" element={<OwnerReportsPage />} />
    <Route path="/owner/profile" element={<ProfilePage />} />

    {/* Controlled legacy aliases retain semantic IDs and hotel context. */}
    <Route path="/partner/dashboard" element={<LegacyOwnerModuleRoute to="/owner/overview" />} />
    <Route path="/partner/hotels" element={<LegacyOwnerModuleRoute to="/owner/hotels" />} />
    <Route path="/partner/hotels/new" element={<LegacyOwnerModuleRoute to="/owner/hotels/new" />} />
    <Route path="/partner/hotels/:hotelId" element={<LegacyOwnerHotelDetailRoute />} />
    <Route path="/partner/hotels/:hotelId/bookings/:bookingId" element={<LegacyOwnerBookingDetailRoute />} />
    <Route path="/partner/hotels/:hotelId/bookings" element={<LegacyOwnerHotelRoute destination="bookings" />} />
    <Route path="/partner/hotels/:hotelId/room-types" element={<LegacyOwnerRoomTypeRoute />} />
    <Route path="/owner/hotels/:hotelId/bookings/:bookingId" element={<LegacyOwnerBookingDetailRoute />} />
    <Route path="/owner/hotels/:hotelId/bookings" element={<LegacyOwnerHotelRoute destination="bookings" />} />
    <Route path="/owner/hotels/:hotelId/analytics" element={<LegacyOwnerHotelRoute destination="revenue" />} />
    <Route path="/partner/bookings" element={<LegacyOwnerModuleRoute to="/owner/bookings" />} />
    <Route path="/partner/inventory-pricing" element={<LegacyOwnerModuleRoute to="/owner/inventory-pricing" />} />
    <Route path="/partner/reports" element={<LegacyOwnerModuleRoute to="/owner/reports" />} />
    <Route path="/partner/revenue" element={<LegacyOwnerModuleRoute to="/owner/revenue" />} />
    <Route path="/partner/room-types" element={<LegacyOwnerModuleRoute to="/owner/room-types" />} />
    <Route path="/partner/room-type-form" element={<LegacyOwnerModuleRoute to="/owner/room-types" />} />
    <Route path="/partner/hotel-form" element={<LegacyOwnerModuleRoute to="/owner/hotels/new" />} />
  </Route>
);
