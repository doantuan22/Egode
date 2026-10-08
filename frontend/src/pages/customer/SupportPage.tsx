import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMyBookings } from '../../features/bookings/hooks';
import { useCreateSupportRequest, useMySupportRequests } from '../../features/support/hooks';
import { cn, formatDateVi } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import type { SupportRequest } from '../../features/support/types';

const SUPPORT_TYPES = ['Hỗ trợ', 'Khiếu nại'];

export default function SupportPage() {
  const requestsQuery = useMySupportRequests();
  const bookingsQuery = useMyBookings();
  const createMutation = useCreateSupportRequest();
  const formRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [loaiYeuCau, setLoaiYeuCau] = useState(SUPPORT_TYPES[0]);
  const [tieuDe, setTieuDe] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [maDatPhong, setMaDatPhong] = useState('');

  const resetForm = () => {
    setLoaiYeuCau(SUPPORT_TYPES[0]);
    setTieuDe('');
    setNoiDung('');
    setMaDatPhong('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { loaiYeuCau, tieuDe: tieuDe.trim(), noiDung: noiDung.trim(), maDatPhong: maDatPhong ? Number(maDatPhong) : undefined },
      { onSuccess: () => { resetForm(); setShowForm(false); } }
    );
  };

  const scrollToForm = () => {
    setShowForm(true);
    setTimeout(() => {
      const form = formRef.current;
      if (typeof form?.scrollIntoView === 'function') {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const historyColumns: Column<SupportRequest>[] = [
    {
      key: 'type',
      header: 'Loại',
      cell: (r) => <span className={cn('badge', r.LoaiYeuCau === 'Khiếu nại' ? 'badge-danger' : 'badge-primary')}>{r.LoaiYeuCau}</span>,
    },
    {
      key: 'title',
      header: 'Tiêu đề & Đơn liên quan',
      cell: (r) => (
        <>
          <Link to={`/support/${r.MaYeuCauHoTro}`} className="ticket-title-link">{r.TieuDe}</Link>
          {r.DAT_PHONG && <span className="ticket-booking-ref block mt-0.5">Đơn liên quan: #{r.DAT_PHONG.MaXacNhanDatPhong}</span>}
        </>
      ),
    },
    { key: 'date', header: 'Ngày gửi', cell: (r) => <span className="text-[13px] text-muted">{formatDateVi(r.NgayTao)}</span> },
    { key: 'status', header: 'Trạng thái', cell: (r) => <StatusBadge domain="support" status={r.TrangThai} /> },
    { key: 'actions', header: 'Thao tác', align: 'right', cell: (r) => <Link to={`/support/${r.MaYeuCauHoTro}`} className="btn btn-outline btn-sm">Xem trao đổi</Link> },
  ];

  return (
    <div className="page-container support-page">
      <div className="page-header">
        <div>
          <h1>Hỗ trợ & Khiếu nại</h1>
          <p className="page-header__desc">Gửi thắc mắc hoặc khiếu nại về đặt phòng và theo dõi tiến độ xử lý của quản trị viên.</p>
        </div>
        <Button type="button" onClick={scrollToForm}>
          <i className="ph ph-plus"></i> Tạo yêu cầu mới
        </Button>
      </div>

      {showForm && (
        <div className="card card-body animate-in slide-in-from-top-4 fade-in duration-300" ref={formRef}>
          <div className="flex justify-between items-center mb-5 pb-3.5 border-b border-border flex-wrap gap-2">
            <h2 className="text-[17px] font-bold text-heading">Gửi yêu cầu hoặc phản ánh dịch vụ</h2>
            <span className="text-[13px] text-muted">Trạng thái xử lý được cập nhật ngay trong danh sách yêu cầu</span>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5">
            {createMutation.isError && (
              <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink border border-danger/30">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Không thể gửi yêu cầu'}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group">
                <label htmlFor="support-field-1" className="form-label">Loại yêu cầu <span className="required">*</span></label>
                <select id="support-field-1" className="select" required value={loaiYeuCau} onChange={e => setLoaiYeuCau(e.target.value)}>
                  {SUPPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="support-field-2" className="form-label">Đơn đặt phòng liên quan <span className="form-hint inline ml-1">(Không bắt buộc)</span></label>
                <select id="support-field-2" className="select" value={maDatPhong} onChange={e => setMaDatPhong(e.target.value)}>
                  <option value="">-- Không liên quan hoặc chọn mã đơn --</option>
                  {bookingsQuery.data?.map(b => (
                    <option key={b.MaDatPhong} value={b.MaDatPhong}>#{b.MaXacNhanDatPhong} - {b.TenKhachSan}</option>
                  ))}
                </select>
              </div>

              <div className="form-group md:col-span-2">
                <label htmlFor="support-field-3" className="form-label">Tiêu đề yêu cầu <span className="required">*</span></label>
                <input id="support-field-3" 
                  type="text" 
                  className="input" 
                  required 
                  placeholder="Tóm tắt ngắn gọn vấn đề của bạn..." 
                  value={tieuDe} 
                  onChange={e => setTieuDe(e.target.value)} 
                />
              </div>

              <div className="form-group md:col-span-2">
                <label htmlFor="support-field-4" className="form-label">Nội dung chi tiết <span className="required">*</span></label>
                <textarea id="support-field-4" 
                  className="textarea" 
                  required 
                  rows={4}
                  placeholder="Vui lòng mô tả chi tiết sự việc..." 
                  value={noiDung} 
                  onChange={e => setNoiDung(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button type="submit" loading={createMutation.isPending}>
                {createMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="card card-body">
        <div className="mb-5 pb-3.5 border-b border-border">
          <h2 className="text-[17px] font-bold text-heading">Lịch sử yêu cầu đã gửi</h2>
          <span className="text-[13px] text-muted block mt-1">Theo dõi tiến độ xử lý các phiếu yêu cầu của bạn</span>
        </div>

        <DataTable
          bare
          caption="Lịch sử yêu cầu hỗ trợ đã gửi"
          columns={historyColumns}
          rows={requestsQuery.data}
          getRowKey={(r) => r.MaYeuCauHoTro}
          isLoading={requestsQuery.isLoading}
          error={requestsQuery.isError ? (requestsQuery.error instanceof ApiError ? requestsQuery.error.message : 'Không thể tải danh sách yêu cầu') : null}
          emptyTitle="Chưa có yêu cầu nào."
          emptyIcon="chat-circle-dots"
        />
      </div>

    </div>
  );
}
