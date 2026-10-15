import { Suspense, useEffect } from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useSignOut } from '../../features/auth/hooks';
import { partnerSignupLock, usePartnerSignupLock } from '../../lib/partnerSignupLock';
import { Navbar } from '../common/Navbar';
import { NavigationEffects } from '../common/NavigationEffects';
import { NavigationProgress } from '../common/NavigationProgress';
import { AppErrorBoundary } from '../common/AppErrorBoundary';
import { RouteFallback } from '../common/RouteFallback';
import { DashboardNavigation, DashboardTopbar } from './DashboardNavigation';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { DashboardUiContext } from '../common/DashboardUiContext';

export function MainLayout() {
  const location = useLocation();
  const role = useAuthStore((state) => state.role);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isAdminDashboard = role === ROLE_NAMES.ADMIN && location.pathname.startsWith('/admin');
  const isPartnerDashboard =
    role === ROLE_NAMES.PARTNER && (location.pathname.startsWith('/owner') || location.pathname.startsWith('/partner'));
  const isDashboard = isAdminDashboard || isPartnerDashboard;
  const dashboardShellClass = isAdminDashboard
    ? 'dashboard-shell dashboard-shell--admin'
    : isPartnerDashboard
      ? 'dashboard-shell dashboard-shell--owner'
      : '';

  const accessToken = useAuthStore((state) => state.accessToken);
  const signupLocked = usePartnerSignupLock();
  const { signOut, isPending: isSigningOut } = useSignOut();
  const isLockedToApply = signupLocked && !!accessToken && role === ROLE_NAMES.CUSTOMER;

  // The lock only makes sense for a signed-in customer; drop it once the session or role changes.
  useEffect(() => {
    if (signupLocked && !isBootstrapping && (!accessToken || (role && role !== ROLE_NAMES.CUSTOMER))) {
      partnerSignupLock.release();
    }
  }, [signupLocked, isBootstrapping, accessToken, role]);

  // Warn on tab close/reload while the lock is on.
  useEffect(() => {
    if (!isLockedToApply) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isLockedToApply]);

  if (isLockedToApply) {
    if (location.pathname !== '/partner/apply') return <Navigate to="/partner/apply" replace />;
    return (
      <DashboardUiContext.Provider value={false}>
        <NavigationEffects />
        <header className="border-b border-border bg-white">
          <div className="page-container flex items-center justify-between py-3">
            <span className="flex items-center gap-2 font-bold text-ink">
              <img src="/egode_logo.png" alt="" className="h-7 w-7" />Egode
            </span>
            <button
              type="button"
              className="text-sm text-ink-muted hover:text-ink disabled:opacity-60"
              disabled={isSigningOut}
              onClick={() => {
                partnerSignupLock.release();
                void signOut();
              }}
            >
              {isSigningOut ? 'Đang thoát...' : 'Huỷ đăng ký đối tác & đăng xuất'}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="focus:outline-none min-h-[60vh]">
          <AppErrorBoundary inline resetKey={location.pathname}><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></AppErrorBoundary>
        </main>
      </DashboardUiContext.Provider>
    );
  }

  return (
    <DashboardUiContext.Provider value={isDashboard}>
    <div className={dashboardShellClass}>
      <a href="#main-content" className="sr-only z-50 rounded bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Chuyển đến nội dung chính</a>
      <NavigationEffects />
      <NavigationProgress />
      
      {isDashboard && role ? (
        <>
          <DashboardNavigation role={role} />
          <div className="dashboard-main">
            <DashboardTopbar role={role} />
            <main id="main-content" tabIndex={-1} className="dashboard-content focus:outline-none">
              <div className="dashboard-content__canvas">
                <AppErrorBoundary inline resetKey={location.pathname}><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></AppErrorBoundary>
              </div>
            </main>
          </div>
        </>
      ) : (
        <>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="focus:outline-none min-h-[60vh]">
            <AppErrorBoundary inline resetKey={location.pathname}><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></AppErrorBoundary>
          </main>
          <footer className="site-footer">
            <div className="site-footer__inner">
              <div className="site-footer__grid">
                <div className="site-footer__col">
                  <div className="site-footer__brand mb-4">
                    <img src="/egode_logo.png" alt="" />Egode
                  </div>
                  <p className="site-footer__tagline">Tìm nơi lưu trú, theo dõi chuyến đi và quản lý cơ sở trên Egode.</p>
                </div>
                <div className="site-footer__col">
                  <h4>Hỗ trợ</h4>
                  <Link to="/support">Trung tâm trợ giúp</Link>
                </div>
                <div className="site-footer__col">
                  <h4>Đối tác</h4>
                  <Link to="/login">Đăng nhập Partner</Link>
                </div>
              </div>
              <div className="site-footer__bottom">
                <p>&copy; {new Date().getFullYear()} Egode. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
    </DashboardUiContext.Provider>
  );
}

export default MainLayout;
