import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** A mutation whose `mutate` finishes at once with `outcome`, the way react-query calls the per-call callbacks. */
const finishing = (outcome: { error: Error } | { data: unknown }) => ({
  ...idle,
  mutate: vi.fn((_vars: unknown, options?: { onSuccess?: (data: unknown) => void; onError?: (error: Error) => void }) => {
    if ('error' in outcome) options?.onError?.(outcome.error);
    else options?.onSuccess?.(outcome.data);
  }),
});

const open = (viewing: number, signedInAs: number, status = 'Hoạt động', mutations: { lock?: unknown; unlock?: unknown } = {}) => {
  vi.mocked(useAccountDetail).mockReturnValue({ isLoading: false, isError: false, data: account(viewing, status) } as unknown as ReturnType<typeof useAccountDetail>);
  vi.mocked(useMe).mockReturnValue({ data: { MaTaiKhoan: signedInAs } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useUpdateAccount).mockReturnValue(idle as unknown as ReturnType<typeof useUpdateAccount>);
  vi.mocked(useUnlockAccount).mockReturnValue((mutations.unlock ?? idle) as unknown as ReturnType<typeof useUnlockAccount>);
vi.mocked(useDeleteAccount).mockReturnValue(idle as unknown as ReturnType<typeof useDeleteAccount>);
  vi.mocked(useLockAccount).mockReturnValue((mutations.lock ?? idle) as unknown as ReturnType<typeof useLockAccount>);
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

  it("shows the server's reason in a notice when the last administrator is protected", async () => {
    open(5, 9, 'Hoạt động', {
      lock: finishing({ error: new ApiError('Không thể khóa quản trị viên cuối cùng — hệ thống phải còn ít nhất một quản trị viên đang hoạt động', 409, undefined, 'CONFLICT') }),
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Khóa tài khoản/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Khóa tài khoản' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Không khóa được tài khoản');
    expect(notice).toHaveTextContent('Không thể khóa quản trị viên cuối cùng');
  });
});

describe('AdminAccountDetailPage — the result of lock and unlock is announced', () => {
  it('locking says who can no longer sign in', async () => {
    open(5, 9, 'Hoạt động', { lock: finishing({ data: account(5, 'Khóa') }) });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Khóa tài khoản/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Khóa tài khoản' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Đã khóa tài khoản');
    expect(notice).toHaveTextContent('Quản trị không thể đăng nhập');
  });

  it('unlocking says the account can sign in again', async () => {
    open(5, 9, 'Khóa', { unlock: finishing({ data: account(5, 'Hoạt động') }) });

    await userEvent.setup().click(screen.getByRole('button', { name: /Mở khóa tài khoản/ }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Đã mở khóa tài khoản');
    expect(notice).toHaveTextContent('có thể đăng nhập trở lại');
  });

  it('a refused unlock is reported as an error notice', async () => {
    open(5, 9, 'Khóa', { unlock: finishing({ error: new ApiError('Tài khoản không ở trạng thái khóa', 409, undefined, 'CONFLICT') }) });

    await userEvent.setup().click(screen.getByRole('button', { name: /Mở khóa tài khoản/ }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Không mở khóa được tài khoản');
    expect(notice).toHaveTextContent('Tài khoản không ở trạng thái khóa');
  });
});
