import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import { listAdminPayments, type AdminPayment } from '../../features/admin/payments/api';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { formatDateTimeVi } from '../../lib/utils';
import { useListParams, useUrlSearchInput } from '../../hooks/useListParams';
import { Pagination } from '../../components/common/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterBar } from '../../components/common/FilterBar';
import { FilterChip } from '../../components/common/FilterChip';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { AdminListPanel } from '../../components/admin/AdminListPanel';
import { Icon } from '../../components/common/Icon';

const STATUSES = ['Thành công', 'Chờ xử lý', 'Thất bại'];
const FILTER_DEFAULTS = { search: '', status: '', method: '', refunded: '' };

export default function AdminPaymentsPage() {
  const { values, page, setValue, setPage, reset } = useListParams(FILTER_DEFAULTS);
  const [searchInput, setSearchInput] = useUrlSearchInput(values.search, (value) => setValue('search', value));
  const search = values.search;
  const status = values.status;
  const method = values.method;
  const refundedOnly = values.refunded === '1';

  const query = useQuery({
    queryKey: ['admin', 'payments', page, search, status, method, refundedOnly],
    queryFn: () =>
      listAdminPayments({
        page,
        limit: 10,
        search: search || undefined,
        TrangThai: status === 'ALL' ? undefined : status || undefined,
        PhuongThucThanhToan: method === 'ALL' ? undefined : method || undefined,
        coHoanTien: refundedOnly || undefined,
      }),
  });

  const activeFilterCount =
    Number(Boolean(search)) +
    Number(Boolean(status && status !== 'ALL')) +
    Number(Boolean(method && method !== 'ALL')) +
    Number(refundedOnly);

  const columns: Column<AdminPayment>[] = [
    {
      key: 'id',
      header: 'Mã giao dịch',
      cell: (payment) => (
        <span className="font-mono text-sm font-bold text-ink">{payment.MaGiaoDichDoiTac || `PAY-${payment.MaThanhToan}`}</span>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      cell: (payment) => <span className="font-mono font-bold text-primary-600">#{payment.DAT_PHONG.MaXacNhanDatPhong}</span>,
    },
    {
      key: 'amount',
      header: 'Số tiền',
      align: 'right',
      cell: (payment) => <strong className="text-sm text-heading">{Number(payment.SoTien).toLocaleString('vi-VN')} đ</strong>,
    },
    { key: 'method', header: 'Phương thức', cell: (payment) => <span className="admin-neutral-tag">{payment.PhuongThucThanhToan}</span> },
    {
      key: 'time',
      header: 'Thời gian',
      align: 'center',
      cell: (payment) => <span className="text-[11px] text-ink-muted">{formatDateTimeVi(payment.ThoiGianGiaoDich)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      cell: (payment) => <StatusBadge domain="payment" status={payment.TrangThai} />,
    },
    {
      key: 'detail',
      header: 'Thao tác',
      align: 'center',
      cell: (payment) => (
        <Link to={`/admin/payments/${payment.MaThanhToan}`} className="admin-row-link">
          <span>Đối soát</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Thanh toán & giao dịch"
        description="Theo dõi giao dịch, trạng thái xử lý và các trường hợp hoàn tiền cần đối soát."
      />

      <AdminListPanel
        itemLabel="giao dịch"
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
                placeholder="Mã booking, mã tham chiếu..."
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <Select
                label="Trạng thái"
                value={status}
                onChange={(e) => {
                  setValue('status', e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[160px] flex-1">
              <Select
                label="Phương thức"
                value={method}
                onChange={(e) => {
                  setValue('method', e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">Tất cả cổng</option>
                <option value="VNPAY">VNPAY</option>
              </Select>
            </div>
            <div role="group" aria-label="Lọc nhanh" className="admin-quick-filters">
              <span>Lọc nhanh</span>
              <FilterChip
                pressed={refundedOnly}
                onClick={() => {
                  setValue('refunded', refundedOnly ? '' : '1');
                  setPage(1);
                }}
              >
                Có hoàn tiền
              </FilterChip>
              <FilterChip
                pressed={status === 'Thất bại'}
                onClick={() => {
                  setValue('status', status === 'Thất bại' ? '' : 'Thất bại');
                  setPage(1);
                }}
              >
                Thất bại
              </FilterChip>
              <FilterChip
                pressed={status === 'Thành công'}
                onClick={() => {
                  setValue('status', status === 'Thành công' ? '' : 'Thành công');
                  setPage(1);
                }}
              >
                Thành công
              </FilterChip>
            </div>
          </FilterBar>
        }
      >
        <DataTable
          bare
          caption="Danh sách giao dịch thanh toán"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(payment) => payment.MaThanhToan}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải giao dịch') : null}
          emptyTitle="Không tìm thấy giao dịch nào"
          emptyDescription="Hãy thay đổi từ khóa hoặc bộ lọc giao dịch."
          emptyIcon="credit-card"
          footer={
            query.data && (
              <Pagination
                page={page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                itemLabel="giao dịch"
                onPageChange={setPage}
              />
            )
          }
        />
      </AdminListPanel>
    </div>
  );
}
