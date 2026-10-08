import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { useUiStore } from '../../lib/store';
import { useAuthStore } from '../../lib/authStore';
import {
  useSignOut,
  useMe,
} from '../../features/auth/hooks';

import {
  ROLE_NAMES,
  profilePathFor,
} from '../../lib/roles';

import { cn } from '../../lib/utils';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useDrawerBehavior } from '../../hooks/useDrawerBehavior';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
  } = useUiStore();

  const accessToken = useAuthStore(
    (s) => s.accessToken
  );

  const role = useAuthStore(
    (s) => s.role
  );

  const meQuery = useMe();

  const {
    signOut,
    isPending: isSigningOut,
  } = useSignOut();

  const [isDropdownOpen, setIsDropdownOpen] =
    useState(false);

  const menuTriggerRef =
    useRef<HTMLButtonElement>(null);

  const drawerRef =
    useRef<HTMLElement>(null);

  const closeDrawer = useCallback(
    () => setSidebarOpen(false),
    [setSidebarOpen]
  );

  useDrawerBehavior({
    open: isSidebarOpen,
    onClose: closeDrawer,
    containerRef: drawerRef,
  });

  useEffect(() => {
    if (!isDropdownOpen) return;

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener(
      'keydown',
      onKeyDown
    );

    return () =>
      document.removeEventListener(
        'keydown',
        onKeyDown
      );
  }, [isDropdownOpen]);

  const navLinks = [
    {
      to: '/',
      label: 'Trang chủ',
    },
    {
      to: '/hotels',
      label: 'Khách sạn',
    },
    {
      to: '/support',
      label: 'Hỗ trợ',
    },
  ];

  const roleDashboard =
    role === ROLE_NAMES.ADMIN
      ? {
          to: '/admin',
          label: 'Quản trị',
        }
      : role === ROLE_NAMES.PARTNER
        ? {
            to: '/owner',
            label: 'Đối tác',
          }
        : null;

  const handleLogout = async () => {
    await signOut();

    navigate('/', {
      replace: true,
    });
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          {/* =========================================
              LOGO
          ========================================= */}

          <Link
            to="/"
            className="
              site-header__logo
              flex
              items-center
            "
            aria-label="Egode - Trang chủ"
          >
            <img
              src="/egode_logo.png"
              alt="Egode"
              className="
                h-[42px]
                w-auto
                max-w-[180px]
                object-contain
              "
            />
          </Link>

          {/* =========================================
              NAVIGATION
          ========================================= */}

          <nav className="site-header__nav">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  location.pathname ===
                    link.to &&
                    'active'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* =========================================
              ACTIONS
          ========================================= */}

          <div className="site-header__actions">
            {accessToken ? (
              <div className="dropdown">
                <button
                  ref={menuTriggerRef}
                  className="site-header__user"
                  onClick={() =>
                    setIsDropdownOpen(
                      !isDropdownOpen
                    )
                  }
                  aria-expanded={
                    isDropdownOpen
                  }
                  aria-haspopup="menu"
                >
                  <div className="site-header__avatar site-header__avatar--initial">
                    {meQuery.data?.HoTen?.charAt(
                      0
                    ) ?? 'U'}
                  </div>

                  <span className="site-header__user-name">
                    {meQuery.data?.HoTen ??
                      'Tài khoản'}
                  </span>

                  <i className="ph ph-caret-down site-header__user-caret" />
                </button>

                <div
                  className={cn(
                    'dropdown-menu',
                    isDropdownOpen && 'open'
                  )}
                >
                  {roleDashboard && (
                    <Link
                      to={
                        roleDashboard.to
                      }
                      className="dropdown-item"
                      onClick={() =>
                        setIsDropdownOpen(
                          false
                        )
                      }
                    >
                      <i className="ph ph-squares-four text-lg" />

                      {
                        roleDashboard.label
                      }
                    </Link>
                  )}

                  <Link
                    to={profilePathFor(
                      role
                    )}
                    className="dropdown-item"
                    onClick={() =>
                      setIsDropdownOpen(
                        false
                      )
                    }
                  >
                    <i className="ph ph-user text-lg" />

                    Tài khoản của tôi
                  </Link>

                  {role ===
                    ROLE_NAMES.CUSTOMER && (
                    <Link
                      to="/bookings"
                      className="dropdown-item"
                      onClick={() =>
                        setIsDropdownOpen(
                          false
                        )
                      }
                    >
                      <i className="ph ph-calendar-check text-lg" />

                      Đơn đặt phòng
                    </Link>
                  )}

                  {role ===
                    ROLE_NAMES.CUSTOMER && (
                    <Link
                      to="/support"
                      className="dropdown-item"
                      onClick={() =>
                        setIsDropdownOpen(
                          false
                        )
                      }
                    >
                      <i className="ph ph-chat-dots text-lg" />

                      Hỗ trợ / Khiếu nại
                    </Link>
                  )}

                  <div className="dropdown-divider" />

                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      setIsDropdownOpen(
                        false
                      );

                      handleLogout();
                    }}
                    disabled={
                      isSigningOut
                    }
                  >
                    <i className="ph ph-sign-out text-lg" />

                    {isSigningOut
                      ? 'Đang thoát...'
                      : 'Đăng xuất'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="
                    btn
                    btn-ghost
                    btn-sm
                    hidden
                    sm:inline-flex
                  "
                >
                  Đăng nhập
                </Link>

                <Link
                  to="/register"
                  className="
                    btn
                    btn-primary
                    btn-sm
                  "
                >
                  Đăng ký
                </Link>
              </>
            )}

            {/* MOBILE MENU BUTTON */}

            <button
              className="
                site-header__icon-btn
                site-header__menu-toggle
              "
              onClick={
                toggleSidebar
              }
              aria-label="Mở menu"
              aria-expanded={
                isSidebarOpen
              }
              aria-controls="public-mobile-navigation"
              aria-haspopup="dialog"
            >
              <i className="ph ph-list" />
            </button>
          </div>
        </div>
      </header>

      {/* =============================================
          MOBILE DRAWER
      ============================================= */}

      <div
        className={cn(
          'mobile-drawer',
          isSidebarOpen && 'open'
        )}
      >
        <button
          type="button"
          className="mobile-drawer__backdrop"
          aria-label="Đóng menu"
          tabIndex={
            isSidebarOpen
              ? 0
              : -1
          }
          onClick={
            toggleSidebar
          }
        />

        <aside
          id="public-mobile-navigation"
          ref={drawerRef}
          className="mobile-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label="Điều hướng chính"
          aria-hidden={
            !isSidebarOpen
          }
          inert={!isSidebarOpen}
        >
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={
                toggleSidebar
              }
              className="btn-icon btn-ghost"
              aria-label="Đóng menu"
            >
              <i
                className="ph ph-x text-2xl"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="space-y-1">
            {navLinks.map(
              (link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={
                    toggleSidebar
                  }
                  className={cn(
                    'mobile-drawer__link',
                    location.pathname ===
                      link.to &&
                      'is-active'
                  )}
                >
                  {link.label}
                </Link>
              )
            )}

            {accessToken && (
              <>
                {roleDashboard && (
                  <Link
                    to={
                      roleDashboard.to
                    }
                    onClick={
                      toggleSidebar
                    }
                    className="mobile-drawer__link"
                  >
                    {
                      roleDashboard.label
                    }
                  </Link>
                )}

                <Link
                  to={profilePathFor(
                    role
                  )}
                  onClick={
                    toggleSidebar
                  }
                  className="mobile-drawer__link"
                >
                  Tài khoản của tôi
                </Link>

                {role ===
                  ROLE_NAMES.CUSTOMER && (
                  <Link
                    to="/bookings"
                    onClick={
                      toggleSidebar
                    }
                    className="mobile-drawer__link"
                  >
                    Đơn đặt phòng
                  </Link>
                )}

                {role ===
                  ROLE_NAMES.CUSTOMER && (
                  <Link
                    to="/support"
                    onClick={
                      toggleSidebar
                    }
                    className="mobile-drawer__link"
                  >
                    Hỗ trợ / Khiếu nại
                  </Link>
                )}
              </>
            )}

            {!accessToken && (
              <>
                <div className="dropdown-divider my-4" />

                <Link
                  to="/login"
                  onClick={
                    toggleSidebar
                  }
                  className="mobile-drawer__link"
                >
                  Đăng nhập
                </Link>

                <Link
                  to="/register"
                  onClick={
                    toggleSidebar
                  }
                  className="
                    mobile-drawer__link
                    is-active
                  "
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}