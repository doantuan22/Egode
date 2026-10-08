import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Navbar } from './Navbar';
import { useMe, useSignOut } from '../../features/auth/hooks';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/auth/hooks');

const links = () => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));

beforeEach(() => {
  vi.mocked(useMe).mockReturnValue({ data: { HoTen: 'Nguyễn A' } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useSignOut).mockReturnValue({ signOut: vi.fn(), isPending: false });
});

const renderAs = (role: string | null) => {
  useAuthStore.setState({ accessToken: role ? 'token' : null, role, isBootstrapping: false });
  renderWithProviders(<Navbar />);
};

describe('Navbar account menu', () => {
  it.each([
    [ROLE_NAMES.ADMIN, '/admin/profile', '/admin'],
    [ROLE_NAMES.PARTNER, '/owner/profile', '/owner'],
  ])('sends %s to the profile inside their own area (%s), so they stay in their dashboard', (role, profile, home) => {
    renderAs(role);

    expect(links()).toContain(profile);
    expect(links()).toContain(home);
    expect(links()).not.toContain('/profile');
  });

  it('gives a customer the customer profile, their bookings and support, all in the avatar menu', () => {
    renderAs(ROLE_NAMES.CUSTOMER);

    expect(links()).toContain('/profile');
    expect(links()).toContain('/bookings');
    // The top bar already links to the help centre as "Hỗ trợ"; "Hỗ trợ / Khiếu nại" is the avatar-menu entry (desktop menu + phone drawer).
    expect(screen.getAllByRole('link', { name: 'Hỗ trợ / Khiếu nại' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Hỗ trợ / Khiếu nại' }).every((a) => a.getAttribute('href') === '/support')).toBe(true);
  });

  it.each([ROLE_NAMES.ADMIN, ROLE_NAMES.PARTNER])('does not offer customer support to %s', (role) => {
    renderAs(role);
    expect(screen.queryByRole('link', { name: 'Hỗ trợ / Khiếu nại' })).not.toBeInTheDocument();
  });

  it.each([ROLE_NAMES.ADMIN, ROLE_NAMES.PARTNER])('does not offer "my bookings" to %s (they cannot book)', (role) => {
    renderAs(role);
    expect(links()).not.toContain('/bookings');
  });

  it('offers sign-in and register to a visitor, and no account links', () => {
    renderAs(null);

    expect(links()).toEqual(expect.arrayContaining(['/login', '/register']));
    expect(links()).not.toContain('/profile');
  });
});
