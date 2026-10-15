import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MainLayout from '../components/layouts/MainLayout';
import { Navbar } from '../components/common/Navbar';
import RegisterPage from '../pages/auth/RegisterPage';
import { useMe, useRegister, useSignOut } from '../features/auth/hooks';
import { useAuthStore } from '../lib/authStore';
import { ROLE_NAMES } from '../lib/roles';
import { partnerSignupLock } from '../lib/partnerSignupLock';
import { renderWithProviders } from './testUtils';

/**
 * Partner-registration flow on the client: the sign-up lock, the navbar for an account whose application is
 * pending / rejected, and the register -> apply hand-off. Backend rules are covered by
 * backend/src/modules/partners/partner-registration-flow.test.ts.
 */

vi.mock('../features/auth/hooks');
vi.mock('../pages/customer/PartnerApplyPage', () => ({ default: () => <div>TRANG NOP HO SO</div> }));

const signOut = vi.fn();

const mockMe = (data: Record<string, unknown> | undefined) =>
  vi.mocked(useMe).mockReturnValue({ data } as unknown as ReturnType<typeof useMe>);

const signIn = (role: string | null) =>
  useAuthStore.setState({ accessToken: role ? 'token' : null, role, isBootstrapping: false });

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined);
  vi.mocked(useSignOut).mockReturnValue({ signOut, isPending: false });
  mockMe({ HoTen: 'Nguyễn A' });
  partnerSignupLock.release();
  signIn(null);
});

afterEach(() => partnerSignupLock.release());

const links = () => [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));

function renderApp(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<div>TRANG CHU</div>} />
        <Route path="/hotels" element={<div>DANH SACH KHACH SAN</div>} />
        <Route path="/bookings" element={<div>DON DAT PHONG</div>} />
        <Route path="/partner/apply" element={<div>TRANG NOP HO SO</div>} />
      </Route>
    </Routes>,
    { route }
  );
}

describe('partner sign-up lock (just registered as a partner)', () => {
  it('sends every other page back to the application page and hides the site navigation', () => {
    signIn(ROLE_NAMES.CUSTOMER);
    partnerSignupLock.activate();

    renderApp('/hotels');

    expect(screen.getByText('TRANG NOP HO SO')).toBeInTheDocument();
    expect(screen.queryByText('DANH SACH KHACH SAN')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(links()).not.toContain('/hotels');
    expect(links()).not.toContain('/bookings');
  });

  it('the home page is redirected too', () => {
    signIn(ROLE_NAMES.CUSTOMER);
    partnerSignupLock.activate();

    renderApp('/');
    expect(screen.getByText('TRANG NOP HO SO')).toBeInTheDocument();
  });

  it('asks the browser to confirm before the tab is closed or reloaded', () => {
    signIn(ROLE_NAMES.CUSTOMER);
    partnerSignupLock.activate();
    renderApp('/partner/apply');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('cancelling releases the lock and signs the user out', async () => {
    signIn(ROLE_NAMES.CUSTOMER);
    partnerSignupLock.activate();
    renderApp('/partner/apply');

    await userEvent.click(screen.getByRole('button', { name: /Huỷ đăng ký đối tác/ }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(partnerSignupLock.isActive()).toBe(false);
  });

  it('is released once the application is submitted, and the site opens again', async () => {
    signIn(ROLE_NAMES.CUSTOMER);
    partnerSignupLock.activate();
    renderApp('/partner/apply');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();

    act(() => partnerSignupLock.release());

    await waitFor(() => expect(screen.getByRole('contentinfo')).toBeInTheDocument());
    expect(links()).toContain('/hotels');
  });

  it('is dropped when the session is gone, so a visitor is never trapped', async () => {
    signIn(null);
    partnerSignupLock.activate();

    renderApp('/hotels');

    await waitFor(() => expect(partnerSignupLock.isActive()).toBe(false));
    expect(screen.getByText('DANH SACH KHACH SAN')).toBeInTheDocument();
  });

  it('is dropped for an account that is already a partner (e.g. approved meanwhile)', async () => {
    signIn(ROLE_NAMES.PARTNER);
    partnerSignupLock.activate();

    renderApp('/hotels');

    await waitFor(() => expect(partnerSignupLock.isActive()).toBe(false));
    expect(screen.getByText('DANH SACH KHACH SAN')).toBeInTheDocument();
  });

  it('does nothing for an ordinary customer', () => {
    signIn(ROLE_NAMES.CUSTOMER);
    renderApp('/hotels');
    expect(screen.getByText('DANH SACH KHACH SAN')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('the footer no longer offers a way to the application page', () => {
    renderApp('/');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByText('Đăng ký chỗ nghỉ')).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: /chỗ nghỉ/i })).not.toBeInTheDocument();
  });
});

describe('navbar by partner-application state', () => {
  const renderNavbar = (role: string | null, account: Record<string, unknown>) => {
    mockMe({ HoTen: 'Nguyễn A', ...account });
    signIn(role);
    renderWithProviders(<Navbar />);
  };

  it('ordinary customer: bookings and support are there, no re-apply button', () => {
    renderNavbar(ROLE_NAMES.CUSTOMER, {});
    expect(links()).toContain('/bookings');
    expect(screen.getAllByRole('link', { name: 'Hỗ trợ / Khiếu nại' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Nộp lại hồ sơ đối tác' })).not.toBeInTheDocument();
  });

  it('pending application: customer features are hidden like a partner, no re-apply button', () => {
    renderNavbar(ROLE_NAMES.CUSTOMER, { DangChoDuyetDoiTac: true });
    expect(links()).not.toContain('/bookings');
    expect(links()).not.toContain('/support');
    expect(screen.queryByRole('link', { name: 'Hỗ trợ / Khiếu nại' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nộp lại hồ sơ đối tác' })).not.toBeInTheDocument();
    // Still a customer: own profile and browsing remain.
    expect(links()).toContain('/profile');
    expect(links()).toContain('/hotels');
  });

  it('rejected application: the re-apply button appears next to the avatar and goes to the application page', () => {
    renderNavbar(ROLE_NAMES.CUSTOMER, { HoSoDoiTacBiTuChoi: true });
    const button = screen.getByRole('link', { name: 'Nộp lại hồ sơ đối tác' });
    expect(button).toHaveAttribute('href', '/partner/apply');
    // Customer features are open again after a rejection.
    expect(links()).toContain('/bookings');
  });

  it.each([ROLE_NAMES.PARTNER, ROLE_NAMES.ADMIN])('rejected flag on a %s does not show the button', (role) => {
    renderNavbar(role, { HoSoDoiTacBiTuChoi: true });
    expect(screen.queryByRole('link', { name: 'Nộp lại hồ sơ đối tác' })).not.toBeInTheDocument();
  });

  it('visitor: no button', () => {
    renderNavbar(null, { HoSoDoiTacBiTuChoi: true });
    expect(screen.queryByRole('link', { name: 'Nộp lại hồ sơ đối tác' })).not.toBeInTheDocument();
  });

  it('account data still loading (no flags yet): nothing breaks and no button', () => {
    mockMe(undefined);
    signIn(ROLE_NAMES.CUSTOMER);
    renderWithProviders(<Navbar />);
    expect(screen.queryByRole('link', { name: 'Nộp lại hồ sơ đối tác' })).not.toBeInTheDocument();
  });
});

describe('register as a partner -> application page', () => {
  const mutateAsync = vi.fn();

  const openRegister = () =>
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/partner/apply" element={<div>TRANG NOP HO SO</div>} />
        <Route path="/" element={<div>TRANG CHU</div>} />
      </Routes>,
      { route: '/register' }
    );

  const fillAndSubmit = async (intentName: RegExp) => {
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: intentName }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await user.type(document.getElementById('register-HoTen') as HTMLElement, 'Nguyễn Văn An');
    await user.type(document.getElementById('register-TenDangNhap') as HTMLElement, 'nguyenvanan');
    await user.type(document.getElementById('register-Email') as HTMLElement, 'an@example.com');
    await user.type(document.getElementById('register-SoDienThoai') as HTMLElement, '0901234567');
    await user.type(document.getElementById('register-MatKhau') as HTMLElement, 'Password123');
    await user.type(document.getElementById('register-confirmMatKhau') as HTMLElement, 'Password123');
    await user.click(document.getElementById('register-DongYDieuKhoan') as HTMLElement);
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
  };

  beforeEach(() => {
    mutateAsync.mockReset();
    vi.mocked(useRegister).mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null } as unknown as ReturnType<typeof useRegister>);
  });

  it('partner intent: goes to the application page and turns the lock on', async () => {
    mutateAsync.mockResolvedValue(undefined);
    openRegister();
    await fillAndSubmit(/Đối tác|đối tác/);

    await waitFor(() => expect(screen.getByText('TRANG NOP HO SO')).toBeInTheDocument());
    expect(partnerSignupLock.isActive()).toBe(true);
  });

  it('customer intent: goes home and no lock', async () => {
    mutateAsync.mockResolvedValue(undefined);
    openRegister();
    await fillAndSubmit(/Khách hàng|khách hàng/);

    await waitFor(() => expect(screen.getByText('TRANG CHU')).toBeInTheDocument());
    expect(partnerSignupLock.isActive()).toBe(false);
  });

  it('a failed registration never turns the lock on', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'));
    openRegister();
    await fillAndSubmit(/Đối tác|đối tác/);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(partnerSignupLock.isActive()).toBe(false);
    expect(screen.queryByText('TRANG NOP HO SO')).not.toBeInTheDocument();
  });
});
