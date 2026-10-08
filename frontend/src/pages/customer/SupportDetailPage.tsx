import { Link, useParams } from 'react-router-dom';
import { useMySupportRequest } from '../../features/support/hooks';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { formatDateTimeVi } from '../../lib/utils';
import { PageSpinner } from '../../components/common/PageSpinner';

export default function SupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestQuery = useMySupportRequest(Number(id));

  if (requestQuery.isLoading) {
    return <PageSpinner />;
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div role="alert" className="mx-auto max-w-md mt-8 rounded-lg bg-danger-light px-4 py-3 text-center text-sm text-danger-ink">
        {requestQuery.error instanceof ApiError ? requestQuery.error.message : 'Không tìm thấy yêu cầu'}
      </div>
    );
  }

  const r = requestQuery.data;

  return (
    <div className="page-container support-page support-page--detail">
      <Link to="/support" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách yêu cầu</span>
      </Link>

      <div className="card card-body max-w-3xl">
        <div className="flex justify-between items-start gap-3 mb-5 pb-4 border-b border-border flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-heading">{r.TieuDe}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {r.LoaiYeuCau} · Gửi lúc {formatDateTimeVi(r.NgayTao)}
            </p>
          </div>
          <StatusBadge domain="support" status={r.TrangThai} />
        </div>

        <div className="space-y-4 text-sm text-body">
          {r.DAT_PHONG && (
             <div><strong>Đơn liên quan:</strong> #{r.DAT_PHONG.MaXacNhanDatPhong}</div>
          )}
          
          <div>
            <strong className="block mb-1 text-heading">Nội dung chi tiết:</strong>
            <p className="whitespace-pre-wrap leading-relaxed">{r.NoiDung}</p>
          </div>
        </div>

        {r.KetQuaXuLy && (
          <div className="mt-6 bg-success-light border border-success-light rounded-lg p-4">
            <h4 className="text-sm font-bold text-success-ink mb-1 flex items-center gap-2">
              <i className="ph-fill ph-check-circle text-success"></i>
              Kết quả xử lý {r.NgayXuLy && <span className="font-normal opacity-80">({formatDateTimeVi(r.NgayXuLy)})</span>}
            </h4>
            <p className="whitespace-pre-wrap text-sm text-success-ink leading-relaxed pl-6">{r.KetQuaXuLy}</p>
          </div>
        )}

      </div>
    </div>
  );
}
