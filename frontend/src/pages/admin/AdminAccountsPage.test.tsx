import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccountsPage from './AdminAccountsPage';
import { useAccountList, useRoles } from '../../features/admin/accounts/hooks';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/admin/accounts/hooks');

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const open = (search = '') =>
  renderWithProviders(
    <>
      <Routes><Route path="/admin/accounts" element={<AdminAccountsPage />} /></Routes>
      <Probe />
    </>,
    { route: `/admin/accounts${search}` }
  );

const lastQuery = () => vi.mocked(useAccountList).mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.mocked(useRoles).mockReset().mockReturnValue({
    data: [
      { MaVaiTro: 1, TenVaiTro: 'Quản trị hệ thống', MoTa: '' },
      { MaVaiTro: 2, TenVaiTro: 'Khách hàng', MoTa: '' },
      { MaVaiTro: 3, TenVaiTro: 'Chủ khách sạn', MoTa: '' },
    ],
  } as unknown as ReturnType<typeof useRoles>);
  vi.mocked(useAccountList).mockReset();
  vi.mocked(useAccountList).mockReturnValue({
    isLoading: false, isError: false,
    data: { items: [], pagination: { page: 1, limit: 10, total: 50, totalPages: 5 } },
  } as unknown as ReturnType<typeof useAccountList>);
});

describe('AdminAccountsPage filters live in the URL', () => {
  it('starts from the filters and page in the link', () => {
    open('?search=an&status=Khóa&page=3');

    expect(lastQuery()).toEqual({ page: 3, limit: 10, search: 'an', TrangThai: 'Khóa' });
    expect(screen.getByPlaceholderText(/Nhập họ tên/)).toHaveValue('an');
    expect(screen.getByLabelText('Trạng thái hoạt động')).toHaveValue('Khóa');
  });

  it('uses the defaults for a plain link', () => {
    open();
    expect(lastQuery()).toEqual({ page: 1, limit: 10, search: undefined, TrangThai: undefined });
  });

  it('changing a filter updates the URL and goes back to the first page', async () => {
    open('?page=3');

    await userEvent.setup().selectOptions(screen.getByLabelText('Trạng thái hoạt động'), 'Hoạt động');

    expect(screen.getByTestId('search')).toHaveTextContent(/^\?status=Ho/);
    expect(screen.getByTestId('search')).not.toHaveTextContent('page=');
    expect(lastQuery()).toMatchObject({ page: 1, TrangThai: 'Hoạt động' });
  });

  it('paging is kept in the URL', async () => {
    open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sau' }));

    expect(screen.getByTestId('search')).toHaveTextContent('?page=2');
    expect(lastQuery()).toMatchObject({ page: 2 });
  });

  it('typing in the search box reaches the URL after a pause', async () => {
    open('?page=2');

    await userEvent.setup().type(screen.getByPlaceholderText(/Nhập họ tên/), 'nam');

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('search=nam'), { timeout: 2000 });
    expect(screen.getByTestId('search')).not.toHaveTextContent('page=');
  });

  it('"Xóa bộ lọc" clears the filters from the URL and the search box', async () => {
    open('?search=an&status=Khóa&page=3');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));

    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
    await waitFor(() => expect(screen.getByPlaceholderText(/Nhập họ tên/)).toHaveValue(''));
    expect(lastQuery()).toEqual({ page: 1, limit: 10, search: undefined, TrangThai: undefined });
  });
});

describe('AdminAccountsPage role filter', () => {
  it('offers customers and hotel owners first, and filters the list by the chosen role', async () => {
    open();
    const select = screen.getByLabelText('Vai trò');
    expect(Array.from(select.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      'Tất cả vai trò',
      'Khách hàng',
      'Chủ khách sạn',
      'Quản trị hệ thống',
    ]);

    await userEvent.setup().selectOptions(select, 'Chủ khách sạn');

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, MaVaiTro: 3 }));
    expect(screen.getByTestId('search')).toHaveTextContent('role=3');
    expect(screen.getByRole('button', { name: /Vai trò: Chủ khách sạn/ })).toBeInTheDocument();
  });

  it('starts from the role in the link and clears it with its chip', async () => {
    open('?role=2');
    expect(lastQuery()).toMatchObject({ MaVaiTro: 2 });
    expect(screen.getByLabelText('Vai trò')).toHaveValue('2');

    await userEvent.setup().click(screen.getByRole('button', { name: /Vai trò: Khách hàng/ }));

    await waitFor(() => expect(lastQuery()?.MaVaiTro).toBeUndefined());
  });
});
