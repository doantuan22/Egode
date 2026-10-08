import { Link } from 'react-router-dom';
import { useAccountList } from '../../features/admin/accounts/hooks';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import type { Account } from '../../types/auth';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AdminListPanel } from '../../components/admin/AdminListPanel';

const PAGE_SIZE = 10;
const FILTER_DEFAULTS = { search: '', status: '' };

export default function AdminAccountsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const query = useAccountList({ page, limit: PAGE_SIZE, search: search || undefined, TrangThai: status || undefined });
  const activeFilterCount = Number(Boolean(search)) + Number(Boolean(status));

  const columns: Column<Account>[] = [
    {
      key: 'id',
      header: 'ID',
      className: 'w-20',
      cell: (account) => <span className="font-mono font-bold text-ink-muted">#{account.MaTaiKhoan}</span>,
    },
    {
      key: 'username',
      header: 'Tên đăng nhập',
      cell: (account) => <span className="font-semibold text-heading">{account.TenDangNhap}</span>,
    },
    {
      key: 'person',
      header: 'Họ tên & Email',
      cell: (account) => (
        <>
          <div className="font-bold text-heading">{account.HoTen}</div>
          <div className="text-[11px] text-ink-muted">{account.Email}</div>
        </>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò',
      align: 'center',
      cell: (account) => <span className="text-ink-sub">{account.VAI_TRO?.TenVaiTro ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      cell: (account) => <StatusBadge domain="account" status={account.TrangThai} />,
    },
    {
      key: 'profile',
      header: 'Thao tác',
      align: 'center',
      cell: (account) => (
        <Link to={`/admin/accounts/${account.MaTaiKhoan}`} className="admin-row-link">
          <span>Quản lý</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Quản lý tài khoản"
        description="Giám sát phân quyền, thông tin định danh và trạng thái hoạt động của tài khoản trên hệ thống."
        actions={
          <Button asChild>
            <Link to="/admin/accounts/new">
              <Icon name="plus" size={16} />
              <span>Thêm tài khoản</span>
            </Link>
          </Button>
        }
      />

      <AdminListPanel
        itemLabel="tài khoản"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <FilterBar onReset={activeFilterCount > 0 ? reset : undefined}>
            <div className="min-w-[240px] flex-[2]">
              <Input
                label="Tìm kiếm"
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Họ tên, email, tên đăng nhập..."
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <Select
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setValue('status', e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Hoạt động">Đang hoạt động</option>
                <option value="Khóa">Đang bị khóa</option>
              </Select>
            </div>
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách tài khoản"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(account) => account.MaTaiKhoan}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải danh sách tài khoản') : null}
          emptyTitle="Không tìm thấy tài khoản nào phù hợp"
          emptyDescription="Hãy thay đổi từ khóa hoặc bộ lọc trạng thái."
          emptyIcon="users"
          footer={
            query.data && (
              <Pagination
                page={page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                itemLabel="tài khoản"
                onPageChange={setPage}
              />
            )
          }
        />
      </AdminListPanel>
    </div>
  );
}
