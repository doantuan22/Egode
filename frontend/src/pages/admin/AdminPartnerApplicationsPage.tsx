import { Link } from 'react-router-dom';
import { useAdminPartnerApplications } from '../../features/partners/hooks';
import type { AdminPartnerApplication } from '../../features/partners/api';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { formatDateTimeVi } from '../../lib/utils';
import { useListParams } from '../../hooks/useListParams';
import { PageHeader } from '../../components/common/PageHeader';
import { FilterChip } from '../../components/common/FilterChip';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Pagination } from '../../components/common/Pagination';
import { AdminListPanel } from '../../components/admin/AdminListPanel';
import { Icon } from '../../components/common/Icon';

const FILTER_DEFAULTS = { status: 'Chờ duyệt' };
const PAGE_SIZE = 10;

export default function AdminPartnerApplicationsPage() {
  const { values, page, setValue, setPage } = useListParams(FILTER_DEFAULTS);
  const status = values.status;
  const setStatus = (value: string) => {
    setValue('status', value);
    setPage(1);
  };
  const query = useAdminPartnerApplications(status === 'ALL' ? undefined : status, page, PAGE_SIZE);
  const activeFilterCount = status && status !== 'ALL' ? 1 : 0;

  const columns: Column<AdminPartnerApplication>[] = [
    { key: 'id', header: 'Mã hồ sơ', cell: (application) => <span className="font-mono font-bold text-primary-600">#{application.MaHoSoDoiTac}</span> },
    { key: 'owner', header: 'Người đại diện', cell: (application) => <span className="font-bold text-heading">{application.TAI_KHOAN_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN.HoTen}</span> },
    { key: 'submitted', header: 'Ngày nộp', align: 'center', cell: (application) => <span className="font-mono text-[11px] text-ink-muted">{formatDateTimeVi(application.NgayNop)}</span> },
    { key: 'status', header: 'Trạng thái', align: 'center', cell: (application) => <StatusBadge domain="partnerApplication" status={application.TrangThaiDuyet} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (application) => (
        <Link to={`/admin/partner-applications/${application.MaHoSoDoiTac}`} className="admin-row-link">
          <span>Thẩm định</span>
          <Icon name="caret-right" size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <PageHeader title="Hồ sơ đăng ký" description="Thẩm định tính pháp lý hồ sơ đối tác chủ khách sạn và cơ sở lưu trú trước khi cho phép mở bán phòng." />

      <AdminListPanel
        itemLabel="hồ sơ"
        total={query.data?.pagination.total}
        activeFilterCount={activeFilterCount}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        filters={
          <div className="admin-filter-chips" role="group" aria-label="Lọc theo trạng thái hồ sơ">
            <span className="admin-filter-chips__label">Trạng thái</span>
            {['ALL', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'].map((st) => (
              <FilterChip key={st} pressed={status === st} onClick={() => setStatus(st)}>
                {st === 'ALL' ? 'Tất cả' : st}
              </FilterChip>
            ))}
          </div>
        }
      >
        <DataTable
          bare
          caption="Danh sách hồ sơ đăng ký đối tác"
          columns={columns}
          rows={query.data?.items}
          getRowKey={(application) => application.MaHoSoDoiTac}
          isLoading={query.isLoading}
          error={query.isError ? (query.error instanceof ApiError ? query.error.message : 'Không thể tải hồ sơ đối tác') : null}
          emptyTitle="Không có hồ sơ đăng ký nào phù hợp"
          emptyDescription="Chưa có hồ sơ với trạng thái đã chọn."
          emptyIcon="files"
          footer={query.data && (
            <Pagination
              page={page}
              totalPages={query.data.pagination.totalPages}
              total={query.data.pagination.total}
              itemLabel="hồ sơ"
              onPageChange={setPage}
            />
          )}
        />
      </AdminListPanel>
    </div>
  );
}
