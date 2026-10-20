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

/** Toàn bộ bảng route, mỗi khu vực một module */
export default function AppRoutes() {
  // Route hiển thị vị trí của trang đã chuyển xong
  const location = usePageTransitionLocation();
  return (
    <Suspense fallback={<div className="flex justify-center py-16" role="status" aria-live="polite"><span className="sr-only">Đang tải trang...</span><div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-blue-600" /></div>}>
      <Routes location={location}>
        <Route element={<MainLayout />}>
          {publicRoutes}
          {customerRoutes}
          {ownerRoutes}
          {adminRoutes}

          {/* Các URL cũ chỉ để chuyển hướng */}
          {aliasRoutes()}

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
