import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_HOME } from '../../lib/roles';

/** Chỉ cho người chưa đăng nhập vào, người đã đăng nhập được chuyển về trang chủ */
export function GuestOnlyRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const [formShown, setFormShown] = useState(false);

  if (isBootstrapping) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-blue-600" />
      </div>
    );
  }

  if (!accessToken && !formShown) setFormShown(true);

  if (accessToken && !formShown) {
    return <Navigate to={(role && ROLE_HOME[role]) || '/'} replace />;
  }

  return <Outlet />;
}
