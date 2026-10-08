import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerCenterNavigation } from './CustomerCenterNavigation';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { renderWithProviders } from '../../test/testUtils';

const renderAt = (route: string, role: string | null = ROLE_NAMES.CUSTOMER) => {
  useAuthStore.setState({ accessToken: role ? 'token' : null, role, isBootstrapping: false });
  renderWithProviders(<CustomerCenterNavigation />, { route });
};

beforeEach(() => useAuthStore.setState({ accessToken: null, role: null, isBootstrapping: false }));

describe('CustomerCenterNavigation', () => {
  it('offers "Đơn đặt phòng của tôi" only; the profile and support are reached from the avatar menu', () => {
    renderAt('/bookings');

    expect(screen.getAllByRole('link').map((a) => [a.getAttribute('href'), a.textContent])).toEqual([['/bookings', 'Đơn đặt phòng của tôi']]);
  });

  it.each(['/bookings', '/bookings/12'])('marks it as the current section on %s', (route) => {
    renderAt(route);

    const link = screen.getByRole('link', { name: 'Đơn đặt phòng của tôi' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('active');
  });

  it.each(['/support', '/support/3'])('is not marked as current on %s (that area is reached from the avatar menu)', (route) => {
    renderAt(route);
    expect(screen.getByRole('link', { name: 'Đơn đặt phòng của tôi' })).not.toHaveAttribute('aria-current');
  });

  it('is not shown to anyone but a customer', () => {
    renderAt('/bookings', ROLE_NAMES.PARTNER);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
