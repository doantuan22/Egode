import { Icon } from '../common/Icon';
import { useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '../../lib/store';
import { useSignOut, useMe } from '../../features/auth/hooks';
import { ROLE_NAMES, profilePathFor } from '../../lib/roles';
import { cn } from '../../lib/utils';
import { useDrawerBehavior } from '../../hooks/useDrawerBehavior';
import { useMediaQuery } from '../../hooks/useMediaQuery';

type DashboardRole = typeof ROLE_NAMES.ADMIN | typeof ROLE_NAMES.PARTNER;

const ownerGroups = [
  { title: 'Quản lý khách sạn', items: [
    { to: '/owner/overview', label: 'Tổng quan', icon: 'squares-four' },
    { to: '/owner/hotels', label: 'Khách sạn của tôi', icon: 'buildings' },
    { to: '/owner/room-types', label: 'Loại phòng', icon: 'bed' },
    { to: '/owner/inventory-pricing', label: 'Quỹ phòng & giá bán', icon: 'calendar-check' },
    { to: '/owner/bookings', label: 'Đặt phòng', icon: 'file-text' },
  ]},
  { title: 'Kinh doanh & báo cáo', items: [
    { to: '/owner/revenue', label: 'Doanh thu', icon: 'credit-card' },
    { to: '/owner/reports', label: 'Báo cáo thống kê', icon: 'chart-bar' },
    { to: '/owner/profile', label: 'Hồ sơ cá nhân', icon: 'user' },
  ]},
];

const adminGroups = [
  { title: 'Tổng quan', items: [
    { to: '/admin', label: 'Bảng điều khiển', icon: 'squares-four' },
    { to: '/admin/analytics', label: 'Thống kê', icon: 'chart-bar' },
  ]},
  { title: 'Đối tác & khách sạn', items: [
    { to: '/admin/partner-applications', label: 'Hồ sơ đăng ký', icon: 'file-text' },
    { to: '/admin/hotels', label: 'Khách sạn', icon: 'buildings' },
  ]},
  { title: 'Người dùng', items: [
    { to: '/admin/accounts', label: 'Tài khoản', icon: 'users' },
  ]},
  { title: 'Giao dịch', items: [
    { to: '/admin/payments', label: 'Thanh toán & giao dịch', icon: 'credit-card' },
    { to: '/admin/promotions', label: 'Khuyến mãi', icon: 'percent' },
  ]},
  { title: 'Nội dung & hỗ trợ', items: [
    { to: '/admin/reviews', label: 'Đánh giá', icon: 'star' },
    { to: '/admin/support', label: 'Hỗ trợ & khiếu nại', icon: 'chat-text' },
  ]},
];

function activePath(pathname: string, to: string) {
  if (to === '/admin') return pathname === to;
  if (to === '/owner/overview') return pathname === to;
  if (to === '/owner/hotels') return pathname === to || pathname === '/owner/hotels/new' || /^\/owner\/hotels\/\d+(\/reviews)?$/.test(pathname);
  if (to === '/owner/room-types') return pathname === to || pathname.startsWith('/owner/room-types/');
  if (to === '/owner/bookings') return pathname === to || pathname.startsWith('/owner/bookings/');
  return pathname === to || pathname.startsWith(`${to}/`);
}

function currentPageLabel(pathname: string, groups: typeof adminGroups) {
  const match = groups
    .flatMap((group) => group.items)
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => activePath(pathname, item.to));
  return match?.label ?? 'Bảng điều khiển';
}

export function DashboardNavigation({ role }: { role: DashboardRole }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSidebarOpen, setSidebarOpen } = useUiStore();
  const { signOut, isPending: isSigningOut } = useSignOut();
  const groups = role === ROLE_NAMES.ADMIN ? adminGroups : ownerGroups;
  const label = role === ROLE_NAMES.ADMIN ? 'Quản trị' : 'Chủ khách sạn';

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  // Below this width (same breakpoint as layout.css) the sidebar is an off-canvas drawer, above it a permanent landmark.
  const isOffCanvas = useMediaQuery('(max-width: 1180px)');
  const sidebarRef = useRef<HTMLElement>(null);
  useDrawerBehavior({ open: isSidebarOpen, onClose: closeSidebar, containerRef: sidebarRef, enabled: isOffCanvas });
  const drawerOpen = isOffCanvas && isSidebarOpen;
  const selectedHotelId = new URLSearchParams(location.search).get('hotelId')
    ?? location.pathname.match(/^\/owner\/hotels\/(\d+)/)?.[1]
    ?? location.pathname.match(/^\/partner\/hotels\/(\d+)/)?.[1];
  const destinationFor = (to: string) => {
    if (role !== ROLE_NAMES.PARTNER || !selectedHotelId || !['/owner/room-types', '/owner/inventory-pricing', '/owner/bookings', '/owner/revenue', '/owner/reports'].includes(to)) return to;
    return `${to}?hotelId=${encodeURIComponent(selectedHotelId)}`;
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn('dashboard-sidebar', isSidebarOpen && 'open')}
        aria-label={`Điều hướng ${label}`}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? true : undefined}
        inert={isOffCanvas && !isSidebarOpen}
      >
        <div className="dashboard-sidebar__brand">
          <Link to="/" className="site-header__logo" onClick={closeSidebar}>
            <img src="/egode_logo.png" alt="" className="site-header__logo-image" />
            <span>Egode</span>
          </Link>
          <span className="badge badge-primary">{label}</span>
        </div>
        <nav className="dashboard-sidebar__nav">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="dashboard-sidebar__group-title">{group.title}</p>
              {group.items.map((item) => {
                const active = activePath(location.pathname, item.to);
                return <Link key={`${item.to}-${item.label}`} to={destinationFor(item.to)} onClick={closeSidebar} className={cn('dashboard-sidebar__item', active && 'active')} aria-current={active ? 'page' : undefined}><Icon name={item.icon} size={18} /><span>{item.label}</span></Link>;
              })}
            </div>
          ))}
        </nav>
        <div className="dashboard-sidebar__footer">
          <button type="button" className="dashboard-sidebar__item text-danger hover:bg-danger-light" onClick={logout} disabled={isSigningOut}><Icon name="sign-out" size={18} /><span>{isSigningOut ? 'Đang thoát...' : 'Đăng xuất'}</span></button>
        </div>
      </aside>
      {isSidebarOpen && <button type="button" aria-label="Đóng menu" className="sidebar-scrim open" onClick={closeSidebar} />}
    </>
  );
}

export function DashboardTopbar({ role }: { role: DashboardRole }) {
  const { pathname } = useLocation();
  const { toggleSidebar } = useUiStore();
  const meQuery = useMe();
  const name = meQuery.data?.HoTen ?? (role === ROLE_NAMES.ADMIN ? 'Quản trị viên' : 'Đối tác');
  const profilePath = profilePathFor(role);
  const pageLabel = useMemo(() => (role === ROLE_NAMES.ADMIN ? currentPageLabel(pathname, adminGroups) : null), [role, pathname]);
  return <header className="dashboard-topbar"><button type="button" className="dashboard-sidebar-toggle btn btn-icon btn-ghost" onClick={toggleSidebar} aria-label="Mở menu"><Icon name="list" size={20} /></button>{pageLabel && <div className="dashboard-topbar__context"><span className="dashboard-topbar__eyebrow">Hệ thống quản trị</span><strong className="dashboard-topbar__title">{pageLabel}</strong></div>}<div className="dashboard-topbar__actions"><Link to={profilePath} className="site-header__user"><span className="site-header__avatar dashboard-user-avatar">{name.charAt(0).toUpperCase()}</span><span className="dashboard-user-meta hidden text-left sm:block"><strong>{name}</strong><small>{role === ROLE_NAMES.ADMIN ? 'Quản trị viên' : 'Chủ khách sạn'}</small></span><Icon name="caret-down" size={16} className="text-ink-muted" /></Link></div></header>;
}
