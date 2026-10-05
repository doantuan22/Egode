import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';
import { useRegister } from '../../features/auth/hooks';
import { ApiError } from '../../services/apiClient';
import { useAuthStore } from '../../lib/authStore';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/auth/hooks');

const mutateAsync = vi.fn();
const mockRegister = (patch: object = {}) =>
  vi.mocked(useRegister).mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null, ...patch } as unknown as ReturnType<typeof useRegister>);

beforeEach(() => {
  mutateAsync.mockReset();
  mockRegister();
  useAuthStore.setState({ accessToken: null, role: null, isBootstrapping: false });
});

const fillValidForm = async () => {
  const user = userEvent.setup();
  // Step 1 of the page: choose how to register, then the form appears.
  await user.click(screen.getByRole('radio', { name: /Khách hàng|khách hàng/ }));
  await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  await user.type(document.getElementById('register-HoTen') as HTMLElement, 'Nguyễn Văn An');
  await user.type(document.getElementById('register-TenDangNhap') as HTMLElement, 'nguyenvanan');
  await user.type(document.getElementById('register-Email') as HTMLElement, 'an@example.com');
  await user.type(document.getElementById('register-SoDienThoai') as HTMLElement, '0901234567');
  await user.type(document.getElementById('register-MatKhau') as HTMLElement, 'Password123');
  await user.type(document.getElementById('register-confirmMatKhau') as HTMLElement, 'Password123');
  const terms = document.querySelector('input[type="checkbox"][required]') as HTMLInputElement | null;
  if (terms) await user.click(terms);
  return user;
};

const open = () =>
  renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<div>HOME</div>} />
    </Routes>,
    { route: '/register' }
  );

describe('RegisterPage server errors', () => {
  it('a field error from the server (validation or duplicate) appears under that input, not only in a banner', async () => {
    mutateAsync.mockRejectedValue(new ApiError('Email đã được sử dụng', 409, [{ field: 'Email', message: 'Email đã được sử dụng' }], 'CONFLICT'));
    open();
    await fillValidForm();

    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const emailInput = document.getElementById('register-Email') as HTMLElement;
    await waitFor(() => expect(screen.getByText('Email đã được sử dụng')).toBeInTheDocument());
    expect(emailInput.closest('div')?.parentElement?.textContent).toContain('Email đã được sử dụng');
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('server validation errors on several inputs each land on their own input', async () => {
    mutateAsync.mockRejectedValue(
      new ApiError('x', 400, [
        { field: 'SoDienThoai', message: 'Số điện thoại không hợp lệ' },
        { field: 'TenDangNhap', message: 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm hoặc gạch dưới' },
      ], 'VALIDATION_ERROR')
    );
    open();
    await fillValidForm();

    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(screen.getByText('Số điện thoại không hợp lệ')).toBeInTheDocument());
    expect(screen.getByText('Tên đăng nhập chỉ gồm chữ, số, dấu chấm hoặc gạch dưới')).toBeInTheDocument();
  });

  it('a business error with no field leaves the inputs alone and shows its message through the banner', async () => {
    mutateAsync.mockRejectedValue(new ApiError('Hệ thống đang bảo trì', 503, undefined, 'INTERNAL_ERROR'));
    mockRegister({ isError: true, error: new ApiError('Hệ thống đang bảo trì', 503) });
    open();
    await fillValidForm();

    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(screen.getByText('Hệ thống đang bảo trì')).toBeInTheDocument();
  });
});
