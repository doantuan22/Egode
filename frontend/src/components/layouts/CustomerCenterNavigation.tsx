import { Link, useLocation } from 'react-router-dom';
import { ROLE_NAMES } from '../../lib/roles';
import { useAuthStore } from '../../lib/authStore';

const destinations = [
  { to: '/bookings', label: 'Đơn đặt phòng của tôi' },
];

export function CustomerCenterNavigation() {
  const role = useAuthStore((state) => state.role);
  const location = useLocation();
  if (role !== ROLE_NAMES.CUSTOMER) return null;

  return (
    <nav className="customer-center-nav" aria-label="Khu vực khách hàng">
      {destinations.map(({ to, label }) => {
        const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
        return (
          <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={active ? 'active' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
