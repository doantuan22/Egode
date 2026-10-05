import { screen, waitFor } from '@testing-library/react';
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

const renderAs = (role: string) => {
  useAuthStore.setState({ accessToken: 'token', role, isBootstrapping: false });
  renderWithProviders(<ProfilePage />);
};

describe('ProfilePage account menu', () => {
  it('gives a customer the customer navigation (bookings, support) and a sign-out button', () => {
    renderAs(ROLE_NAMES.CUSTOMER);

    expect(screen.getByRole('link', { name: 'Đặt phòng của tôi' })).toHaveAttribute('href', '/bookings');
    expect(screen.getByRole('link', { name: 'Hỗ trợ/Khiếu nại' })).toHaveAttribute('href', '/support');
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it.each([ROLE_NAMES.ADMIN, ROLE_NAMES.PARTNER])('shows %s only the profile, inside their dashboard, without customer-only links', (role) => {
    renderAs(role);

    expect(screen.getByRole('heading', { name: 'Hồ sơ cá nhân' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đặt phòng của tôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hỗ trợ/Khiếu nại' })).not.toBeInTheDocument();
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
    renderAs(ROLE_NAMES.CUSTOMER);

    expect(field('Mật khẩu hiện tại')).toHaveAttribute('type', 'password');
    expect(field('Mật khẩu mới')).toHaveAttribute('type', 'password');
    expect(field('Xác nhận mật khẩu mới')).toHaveAttribute('type', 'password');
    expect(screen.queryByText(/link xác nhận tới email/i)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/reset-password"]')).toBeNull();
  });

  it('sends the current and the new password — not the confirmation — to the change-password endpoint', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toEqual({ MatKhauCu: 'Old-Passw0rd!', MatKhauMoi: 'New-Passw0rd!' });
  });

  it('confirmation that does not match: field error, nothing is sent', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'Different-Passw0rd!');

    await submit(user);

    expect(await screen.findByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('empty current password and a too-short new one: field errors, nothing is sent', async () => {
    const mutate = mockChangePassword();
    renderAs(ROLE_NAMES.CUSTOMER);
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
    renderAs(ROLE_NAMES.CUSTOMER);
    const user = userEvent.setup();
    await fill(user, 'Wrong-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    const message = await screen.findByText('Mật khẩu hiện tại không đúng');
    expect(message.id).toBe('profile-MatKhauCu-error');
    expect(field('Mật khẩu hiện tại')).toHaveAttribute('aria-invalid', 'true');
  });

  it('an error with no field (for example the server is down) is shown as a banner with the server message', () => {
    mockChangePassword({ isError: true, error: new ApiError('Quá nhiều yêu cầu. Vui lòng thử lại sau.', 429, undefined, 'TOO_MANY_REQUESTS') });
    renderAs(ROLE_NAMES.CUSTOMER);
    expect(screen.getByRole('alert')).toHaveTextContent('Quá nhiều yêu cầu. Vui lòng thử lại sau.');
  });

  it('success: confirmation message and the form is emptied', async () => {
    mockChangePassword({ isSuccess: true }, ({ onSuccess }) => onSuccess?.());
    renderAs(ROLE_NAMES.CUSTOMER);
    const user = userEvent.setup();
    await fill(user, 'Old-Passw0rd!', 'New-Passw0rd!', 'New-Passw0rd!');

    await submit(user);

    expect(screen.getByRole('status')).toHaveTextContent('Đổi mật khẩu thành công');
    await waitFor(() => expect(field('Mật khẩu hiện tại')).toHaveValue(''));
    expect(field('Mật khẩu mới')).toHaveValue('');
  });

  it('blocks a second click while the request is in flight', () => {
    mockChangePassword({ isPending: true });
    renderAs(ROLE_NAMES.CUSTOMER);
    expect(screen.getByRole('button', { name: 'Đang đổi...' })).toBeDisabled();
  });
});
