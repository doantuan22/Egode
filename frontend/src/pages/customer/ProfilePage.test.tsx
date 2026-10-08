import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from './ProfilePage';
import { useChangePassword, useMe, useSignOut, useUpdateProfile } from '../../features/auth/hooks';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../../lib/authStore';
import { ROLE_NAMES } from '../../lib/roles';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/auth/hooks');

beforeEach(() => {
  vi.mocked(useMe).mockReturnValue({
    isLoading: false, isError: false,
    data: { HoTen: 'Nguyễn A', Email: 'tuan@example.com', TenDangNhap: 'a', SoDienThoai: '0900000000', NgaySinh: null, GioiTinh: null },
  } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useUpdateProfile).mockReturnValue({ mutate: vi.fn(), isPending: false, isSuccess: false, isError: false } as unknown as ReturnType<typeof useUpdateProfile>);
  vi.mocked(useSignOut).mockReturnValue({ signOut: vi.fn(), isPending: false });
  mockChangePassword();
});

/** `behaviour` lets a test play out what the server answers by calling the mutate options. */
const mockChangePassword = (state: Record<string, unknown> = {}, behaviour?: (options: { onSuccess?: () => void; onError?: (e: unknown) => void }) => void) => {
  const mutate = vi.fn((_payload: unknown, options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => behaviour?.(options ?? {}));
  vi.mocked(useChangePassword).mockReturnValue({ mutate, isPending: false, isSuccess: false, isError: false, error: null, ...state } as unknown as ReturnType<typeof useChangePassword>);
  return mutate;
};

const renderAs = (role: string, route = '/profile') => {
  useAuthStore.setState({ accessToken: 'token', role, isBootstrapping: false });
  return renderWithProviders(<ProfilePage />, { route });
};

/** A customer opens the password form from the side menu: /profile?muc=mat-khau. */
const PASSWORD_ROUTE = '/profile?muc=mat-khau';

describe('ProfilePage for a customer: a side menu with three entries', () => {
  it('offers Hồ sơ cá nhân, Đổi mật khẩu and Đăng xuất — and nothing else', () => {
    renderAs(ROLE_NAMES.CUSTOMER);

    const menu = screen.getByRole('navigation', { name: 'Hồ sơ tài khoản' });
    expect(within(menu).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Hồ sơ cá nhân', '/profile'],
      ['Đổi mật khẩu', '/profile?muc=mat-khau'],
    ]);
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    // Bookings and support are in the avatar menu of the top bar, not here.
    expect(screen.queryByRole('link', { name: 'Đặt phòng của tôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hỗ trợ/Khiếu nại' })).not.toBeInTheDocument();
  });

  it('opens on the personal details, with the menu entry marked as current and no password form', () => {
    renderAs(ROLE_NAMES.CUSTOMER);

    expect(screen.getByRole('heading', { level: 1, name: /hồ sơ cá nhân/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hồ sơ cá nhân' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument();
  });

  it('shows only the password form when "Đổi mật khẩu" is open, and the entry is marked as current', () => {
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);

    expect(screen.getByRole('heading', { level: 1, name: /đổi mật khẩu/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đổi mật khẩu' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByLabelText('Họ và tên')).not.toBeInTheDocument();
  });

  it('switches between the two sections from the menu', async () => {
    renderAs(ROLE_NAMES.CUSTOMER);
    const user = userEvent.setup();

    await user.click(screen.getByRole('link', { name: 'Đổi mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Hồ sơ cá nhân' }));
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument();
  });

  it('signs the customer out from the menu', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSignOut).mockReturnValue({ signOut, isPending: false });
    renderAs(ROLE_NAMES.CUSTOMER);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Đăng xuất' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('ProfilePage inside the admin and owner dashboards: no side menu, both sections stacked', () => {
  it.each([ROLE_NAMES.ADMIN, ROLE_NAMES.PARTNER])('shows %s the profile and the password form together', (role) => {
    renderAs(role);

    expect(screen.getByRole('heading', { level: 1, name: /hồ sơ cá nhân/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Hồ sơ tài khoản' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).not.toBeInTheDocument();
  });
});

describe('ProfilePage password form helpers', () => {
  const rule = (name: string) => screen.getByRole('list', { name: 'Yêu cầu mật khẩu' }).textContent?.includes(`${name} (đã đạt)`);

  it('shows the three rules as not met until the customer types, then ticks each one as it is satisfied', async () => {
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    expect(rule('Ít nhất 8 ký tự')).toBe(false);
    expect(rule('Khác mật khẩu hiện tại')).toBe(false);
    expect(rule('Mật khẩu xác nhận khớp')).toBe(false);

    await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'Old-Passw0rd!');
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'short');
    expect(rule('Ít nhất 8 ký tự')).toBe(false);
    expect(rule('Khác mật khẩu hiện tại')).toBe(true);

    await user.type(screen.getByLabelText('Mật khẩu mới'), '-and-long');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'short-and-long');
    expect(rule('Ít nhất 8 ký tự')).toBe(true);
    expect(rule('Mật khẩu xác nhận khớp')).toBe(true);

    await user.clear(screen.getByLabelText('Mật khẩu mới'));
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'Old-Passw0rd!');
    expect(rule('Khác mật khẩu hiện tại')).toBe(false); // same as the current one
    expect(rule('Mật khẩu xác nhận khớp')).toBe(false);
  });

  it('shows and hides each password field on its own', async () => {
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu mới' }));

    expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Xác nhận mật khẩu mới')).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Ẩn mật khẩu mới' }));
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('type', 'password');
  });
});

describe('ProfilePage change password (current + new + confirmation, protected endpoint)', () => {
  const field = (label: string) => screen.getByLabelText(label);
  const fill = async (user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) => {
    if (current) await user.type(field('Mật khẩu hiện tại'), current);
    if (next) await user.type(field('Mật khẩu mới'), next);
    if (confirm) await user.type(field('Xác nhận mật khẩu mới'), confirm);
  };
  const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

  it('shows the three fields and does NOT use the e-mail (forgot-password) flow', () => {
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);

    expect(field('Mật khẩu hiện tại')).toHaveAttribute('type', 'password');
    expect(field('Mật khẩu mới')).toHaveAttribute('type', 'password');
    expect(field('Xác nhận mật khẩu mới')).toHaveAttribute('type', 'password');
    expect(screen.queryByText(/link xác nhận tới email/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/reset-password"]')).toBeNull();
  });

  it('sends the current and the new password — not the confirmation — to the change-password endpoint', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toEqual({ MatKhauCu: 'Old-Passw0rd!', MatKhauMoi: 'New-Passw0rd!' });
  });

  it('confirmation that does not match: field error, nothing is sent', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'Different-Passw0rd!');

    await submit(user);

    expect(await screen.findByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('empty current password and a too-short new one: field errors, nothing is sent', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    await fill(user, '', 'short', 'short');

    await submit(user);

    expect(await screen.findByText('Vui lòng nhập mật khẩu hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('a wrong current password from the server lands under the "Mật khẩu hiện tại" input', async () => {
    mockChangePassword({ isError: true, error: new ApiError('Mật khẩu hiện tại không đúng', 400, [{ field: 'MatKhauCu', message: 'Mật khẩu hiện tại không đúng' }], 'BAD_REQUEST') }, ({ onError }) =>
      onError?.(new ApiError('Mật khẩu hiện tại không đúng', 400, [{ field: 'MatKhauCu', message: 'Mật khẩu hiện tại không đúng' }], 'BAD_REQUEST'))
    );
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    await fill(user, 'Wrong-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    const message = await screen.findByText('Mật khẩu hiện tại không đúng');
    expect(message.id).toBe('profile-MatKhauCu-error');
    expect(field('Mật khẩu hiện tại')).toHaveAttribute('aria-invalid', 'true');
  });

  it('an error with no field (for example the server is down) is shown as a banner with the server message', () => {
    mockChangePassword({ isError: true, error: new ApiError('Quá nhiều yêu cầu. Vui lòng thử lại sau.', 429, undefined, 'TOO_MANY_REQUESTS') });
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    expect(screen.getByRole('alert')).toHaveTextContent('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
  });

  it('success: confirmation message and the form is emptied', async () => {
    mockChangePassword({ isSuccess: true }, ({ onSuccess }) => onSuccess?.());
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    expect(screen.getByRole('status')).toHaveTextContent('Đổi mật khẩu thành công');
    await waitFor(() => expect(field('Mật khẩu hiện tại')).toHaveValue(''));
    expect(field('Mật khẩu mới')).toHaveValue('');
  });

  it('blocks a second click while the request is in flight', () => {
    mockChangePassword({ isPending: true });
    renderAs(ROLE_NAMES.CUSTOMER, PASSWORD_ROUTE);
    expect(screen.getByRole('button', { name: 'Đang đổi...' })).toBeDisabled();
  });
});
