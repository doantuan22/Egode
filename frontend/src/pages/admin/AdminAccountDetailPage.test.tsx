import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccountDetailPage from './AdminAccountDetailPage';
import { useAccountDetail, useDeleteAccount, useLockAccount, useUnlockAccount, useUpdateAccount } from '../../features/admin/accounts/hooks';
import { useMe } from '../../features/auth/hooks';
import { ApiError } from '../../services/apiClient';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/admin/accounts/hooks');
vi.mock('../../features/auth/hooks');

const account = (MaTaiKhoan: number, TrangThai = 'Hoạt động') => ({
  MaTaiKhoan, TenDangNhap: 'admin01', Email: 'admin@example.com', HoTen: 'Quản trị', SoDienThoai: '0901234567',
  NgaySinh: null, GioiTinh: null, TrangThai, VAI_TRO: { TenVaiTro: 'Quản trị hệ thống' }, NgayTao: '2026-01-01T00:00:00.000Z',
});
const idle = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null, isSuccess: false, data: undefined };

const open = (viewing: number, signedInAs: number, status = 'Hoạt động', mutationError?: Error) => {
  vi.mocked(useAccountDetail).mockReturnValue({ isLoading: false, isError: false, data: account(viewing, status) } as unknown as ReturnType<typeof useAccountDetail>);
  vi.mocked(useMe).mockReturnValue({ data: { MaTaiKhoan: signedInAs } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useUpdateAccount).mockReturnValue(idle as unknown as ReturnType<typeof useUpdateAccount>);
  vi.mocked(useUnlockAccount).mockReturnValue(idle as unknown as ReturnType<typeof useUnlockAccount>);
  vi.mocked(useDeleteAccount).mockReturnValue(idle as unknown as ReturnType<typeof useDeleteAccount>);
  vi.mocked(useLockAccount).mockReturnValue((mutationError ? { ...idle, isError: true, error: mutationError } : idle) as unknown as ReturnType<typeof useLockAccount>);
  renderWithProviders(
    <FeedbackProvider>
      <Routes><Route path="/admin/accounts/:id" element={<AdminAccountDetailPage />} /></Routes>
    </FeedbackProvider>,
    { route: `/admin/accounts/${viewing}` }
  );
};

beforeEach(() => vi.resetAllMocks());

describe('AdminAccountDetailPage — administrators are not offered actions against themselves', () => {
  it("another account: lock and delete are available", () => {
    open(5, 9);
    expect(screen.getByRole('button', { name: /Khóa tài khoản/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa tài khoản/ })).toBeInTheDocument();
  });

  it('own account: no lock, no delete, and a note saying why', () => {
    open(9, 9);
    expect(screen.queryByRole('button', { name: /Khóa tài khoản/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa tài khoản/ })).not.toBeInTheDocument();
    expect(screen.getByText(/không thể tự khóa hoặc xóa chính mình/)).toBeInTheDocument();
  });

  it("shows the server's reason when the last administrator is protected", () => {
    open(5, 9, 'Hoạt động', new ApiError('Không thể khóa quản trị viên cuối cùng — hệ thống phải còn ít nhất một quản trị viên đang hoạt động', 409, undefined, 'CONFLICT'));
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể khóa quản trị viên cuối cùng');
  });
});
