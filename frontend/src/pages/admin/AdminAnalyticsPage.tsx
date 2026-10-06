import { useState } from 'react';
import { BarList } from '../../components/analytics/BarList';
import { DateRangeFilter } from '../../components/analytics/DateRangeFilter';
import { useAdminAnalytics } from '../../features/analytics/hooks';
import { formatCurrencyVND } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { PageSpinner } from '../../components/common/PageSpinner';
import { Button } from '../../components/common/Button';

export default function AdminAnalyticsPage() {
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  const analyticsQuery = useAdminAnalytics(appliedRange);
  const data = analyticsQuery.data;

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">Báo cáo & thống kê hệ thống</h1>
          <p className="text-sm text-ink-muted mt-0.5">Giám sát tổng thể hoạt động sàn, số liệu tài chính giao dịch và hoàn tiền.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => analyticsQuery.refetch()}
            disabled={analyticsQuery.isFetching}
            variant="outline"
          >
            <i className={`ph ph-arrows-clockwise text-[16px] ${analyticsQuery.isFetching ? 'animate-spin' : ''}`}></i>
            <span>Làm mới dữ liệu</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-[16px] border border-border shadow-sm p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
           <div className="flex-1">
             <DateRangeFilter
                from={fromInput}
                to={toInput}
                onFromChange={setFromInput}
                onToChange={setToInput}
                onApply={() => setAppliedRange({ from: fromInput || undefined, to: toInput || undefined })}
                onClear={() => {
                  setFromInput('');
                  setToInput('');
                  setAppliedRange({});
                }}
              />
           </div>
           <p className="text-[11px] text-ink-muted md:max-w-xs pb-1">
              * Khoảng thời gian áp dụng cho booking, thanh toán, hoàn tiền và hỗ trợ.
           </p>
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <PageSpinner />
      ) : analyticsQuery.isError || !data ? (
        <div role="alert" className="p-4 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
          {analyticsQuery.error instanceof ApiError ? analyticsQuery.error.message : 'Không thể tải thống kê'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tổng tài khoản</p>
                <h3 className="text-2xl font-bold text-heading mt-1">{data.TongTaiKhoan.toLocaleString('vi-VN')}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                <i className="ph ph-users-three text-[22px]"></i>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tổng khách sạn</p>
                <h3 className="text-2xl font-bold text-heading mt-1">{data.TongKhachSan.toLocaleString('vi-VN')}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary flex items-center justify-center font-bold">
                <i className="ph ph-buildings text-[22px]"></i>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tổng lượt booking</p>
                <h3 className="text-2xl font-bold text-success mt-1">{data.TongSoBooking.toLocaleString('vi-VN')}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-success-light text-success flex items-center justify-center font-bold">
                <i className="ph ph-clipboard-text text-[22px]"></i>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tổng giao dịch</p>
                <h3 className="text-2xl font-bold text-heading mt-1">{data.TongGiaoDich.toLocaleString('vi-VN')}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-warning-light text-warning-ink flex items-center justify-center font-bold">
                <i className="ph ph-credit-card text-[22px]"></i>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
             <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Doanh thu hệ thống (GMV)</p>
                <h3 className="text-xl font-black text-heading mt-1">{formatCurrencyVND(data.DoanhThuHeThong)}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-secondary text-ink-muted flex items-center justify-center font-bold">
                <i className="ph ph-wallet text-[20px]"></i>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-danger uppercase tracking-wider">Đã hoàn tiền</p>
                <h3 className="text-xl font-black text-danger mt-1">{formatCurrencyVND(data.TongHoanTien)}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-danger-light text-danger flex items-center justify-center font-bold">
                <i className="ph ph-arrow-u-down-left text-[20px]"></i>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 text-success/10">
                 <i className="ph-fill ph-trend-up text-6xl"></i>
              </div>
              <div className="relative z-10">
                <p className="text-[11px] font-bold text-success uppercase tracking-wider">Doanh thu thực nhận (Phí sàn)</p>
                <h3 className="text-xl font-black text-success mt-1">{formatCurrencyVND(data.DoanhThuThucNhan)}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-users-three text-primary"></i> Tài khoản theo vai trò
               </h3>
               <div className="flex-1">
                 <BarList items={data.TaiKhoanTheoVaiTro.map((r) => ({ label: r.Label, value: r.SoLuong }))} />
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-buildings text-primary-500"></i> Khách sạn theo trạng thái
               </h3>
               <div className="flex-1">
                 <BarList items={data.KhachSanTheoTrangThai.map((r) => ({ label: r.Label, value: r.SoLuong }))} />
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-calendar-check text-success"></i> Đặt phòng theo trạng thái
               </h3>
               <div className="flex-1">
                 <BarList items={data.BookingTheoTrangThai.map((r) => ({ label: r.TrangThai, value: r.SoLuong }))} emptyMessage="Chưa có đặt phòng nào" />
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-credit-card text-warning"></i> Thanh toán & Hoàn tiền
               </h3>
               <div className="flex-1 space-y-6">
                 <div>
                    <h4 className="text-xs font-semibold text-ink-muted mb-2">Trạng thái thanh toán</h4>
                    <BarList items={data.ThanhToanTheoTrangThai.map((r) => ({ label: r.Label, value: r.SoLuong }))} emptyMessage="Chưa có giao dịch thanh toán nào" />
                 </div>
                 <div>
                    <h4 className="text-xs font-semibold text-ink-muted mb-2">Trạng thái hoàn tiền</h4>
                    <BarList items={data.HoanTienTheoTrangThai.map((r) => ({ label: r.Label, value: r.SoLuong }))} emptyMessage="Chưa có yêu cầu hoàn tiền nào" />
                 </div>
               </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-star text-warning"></i> Đánh giá theo trạng thái (Toàn thời gian)
               </h3>
               <div className="flex-1">
                 <BarList items={data.DanhGiaTheoTrangThai.map((r) => ({ label: r.Label, value: r.SoLuong }))} emptyMessage="Chưa có đánh giá nào" />
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col">
               <h3 className="text-sm font-bold text-heading flex items-center gap-2 mb-4 pb-3 border-b border-surface-tertiary">
                 <i className="ph-fill ph-lifebuoy text-danger"></i> Yêu cầu hỗ trợ/khiếu nại
               </h3>
               <div className="flex-1">
                 <BarList items={data.YeuCauHoTroTheoTrangThai.map((r) => ({ label: r.Label, value: r.SoLuong }))} emptyMessage="Chưa có yêu cầu hỗ trợ nào" />
               </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
