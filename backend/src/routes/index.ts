import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes';
import authRoutes from '../modules/auth/auth.routes';
import profileRoutes from '../modules/profile/profile.routes';
import accountsRoutes from '../modules/accounts/accounts.routes';
import partnersRoutes, { adminPartnerApplicationRoutes } from '../modules/partners/partners.routes';
import hotelsRoutes from '../modules/hotels/hotels.routes';
import amenitiesRoutes from '../modules/amenities/amenities.routes';
import ownerHotelsRoutes from '../modules/owner/owner-hotels.routes';
import ownerRoomTypesRoutes from '../modules/owner/owner-room-types.routes';
import locationsRoutes from '../modules/locations/locations.routes';
import cancellationPoliciesRoutes from '../modules/cancellation-policies/cancellation-policies.routes';
import quotesRoutes from '../modules/quotes/quotes.routes';
import bookingsRoutes, { myBookingsRoutes } from '../modules/bookings/bookings.routes';
import { paymentsBookingRoutes, paymentsGatewayRoutes } from '../modules/payments/payments.routes';
import { reviewsBookingRoutes, adminReviewsRoutes, hotelReviewsRoutes } from '../modules/reviews/reviews.routes';
import { supportRoutes, adminSupportRoutes } from '../modules/support/support.routes';
import promotionsRoutes from '../modules/promotions/promotions.routes';
import ownerAnalyticsRoutes from '../modules/owner/owner-analytics.routes';
import adminAnalyticsRoutes from '../modules/analytics/admin-analytics.routes';
import adminHotelsRoutes from '../modules/admin-hotels/admin-hotels.routes';
import adminPaymentsRoutes from '../modules/admin-payments/admin-payments.routes';
import { openApiSpec } from '../config/openapi';

const router = Router();

// Health routes
router.use('/', healthRoutes);

// Identity (M1)
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/admin/accounts', accountsRoutes);
router.use('/partners', partnersRoutes);
router.use('/admin/partner-applications', adminPartnerApplicationRoutes);

// Discovery (M2)
router.use('/hotels', hotelsRoutes);
router.use('/hotels', quotesRoutes);
router.use('/amenities', amenitiesRoutes);
router.use('/locations', locationsRoutes);
router.use('/cancellation-policies', cancellationPoliciesRoutes);

// Booking (M5)
router.use('/hotels', bookingsRoutes);

// Payment, cancellation & refund (M6)
router.use('/bookings', myBookingsRoutes);
router.use('/bookings', paymentsBookingRoutes);
router.use('/payments', paymentsGatewayRoutes);

// Owner / Supply (M3)
router.use('/owner/hotels', ownerHotelsRoutes);
router.use('/owner/room-types', ownerRoomTypesRoutes);
router.use('/owner/hotels', ownerAnalyticsRoutes);

// After-sales: review + support/complaint (M7)
router.use('/bookings', reviewsBookingRoutes);
router.use('/admin/reviews', adminReviewsRoutes);
router.use('/hotels', hotelReviewsRoutes);
router.use('/support', supportRoutes);
router.use('/admin/support', adminSupportRoutes);

// Promotion management + analytics/reports (M8)
router.use('/admin/promotions', promotionsRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/admin/hotels', adminHotelsRoutes);
router.use('/admin/payments', adminPaymentsRoutes);

// OpenAPI specification route
router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

export default router;
