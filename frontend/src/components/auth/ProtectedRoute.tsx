import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/authStore';
import { useToast } from '../common/FeedbackProvider';
import type { RoleName } from '../../lib/roles';

interface ProtectedRouteProps {
  allowedRoles?: RoleName[];
}

/** Chặn route theo đăng nhập và vai trò ở phía giao diện */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const notify = useToast();
  const roleDenied = !isBootstrapping && !!accessToken && !!allowedRoles && (!role || !allowedRoles.includes(role as RoleName));
  const notified = useRef(false);

  useEffect(() => {
    if (!roleDenied || notified.current) return;
    notified.current = true;
    notify({ title: 'Bạn không có quyền truy cập trang này', tone: 'warning' });
  }, [roleDenied, notify]);

  if (isBootstrapping) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-blue-600" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roleDenied) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
