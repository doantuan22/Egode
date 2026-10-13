import { lazy, Suspense } from 'react';
import { usePageTransitionLocation } from '../lib/usePageTransitionLocation';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';
import { aliasRoutes } from './aliases';
import { adminRoutes } from './adminRoutes';
import { customerRoutes } from './customerRoutes';
import { ownerRoutes } from './ownerRoutes';
import { publicRoutes } from './publicRoutes';

const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage'));

/** The whole route table: each area (public, customer, owner, admin) lives in its own module. */
export default function AppRoutes() {
  // The routes render the location whose page has been dissolved in, not the one the URL already points at.
  const location = usePageTransitionLocation();
  return (
    <Suspense fallback={<div className="flex justify-center py-16" role="status" aria-live="polite"><span className="sr-only">Đang tải trang...</span><div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-blue-600" /></div>}>
      <Routes location={location}>
        <Route element={<MainLayout />}>
          {publicRoutes}
          {customerRoutes}
          {ownerRoutes}
          {adminRoutes}

          {/* Legacy URLs kept only as redirects to their canonical route. */}
          {aliasRoutes()}

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
