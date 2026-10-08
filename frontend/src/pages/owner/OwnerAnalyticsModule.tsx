import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/common/Icon';
import { useSearchParams } from 'react-router-dom';
import { OwnerScopeGate } from '../../components/owner/OwnerScopeGate';
import { BarList } from '../../components/analytics/BarList';
import { useOwnerHotelAnalytics } from '../../features/analytics/hooks';
import { formatCurrencyVND } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';
import { useScopedHotels } from '../../components/owner/useScopedHotels';
import { Button } from '../../components/common/Button';
import { DateField } from '../../components/common/DateField';

export default function OwnerAnalyticsModule({ mode }: { mode: 'revenue' | 'reports' }) {
  const scope = useScopedHotels();
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const applied = { from: params.get('from') || undefined, to: params.get('to') || undefined };
  const analytics = useOwnerHotelAnalytics(scope.hotelId ?? 0, applied);
  const setRange = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (from) next.set('from', from);
    else next.delete('from');
    if (to) next.set('to', to);
    else next.delete('to');
    setParams(next);
  };
  const data = analytics.data;
  const reports = mode === 'reports';
  return (
    <div className="owner-module space-y-6">
      <header className="owner-module__header">
        <div className="owner-module__title">
          <span className="owner-module__icon">{reports ? <Icon name="chart-bar" size={20} /> : <Icon name="currency-circle-dollar" size={20} />}</span>
          <div>
            <h1>{reports ? 'Báo cáo thống kê' : 'Doanh thu'}</h1>
            <p>
              {reports
                ? 'Theo dõi trạng thái đặt phòng, loại phòng phổ biến và tỷ lệ lấp đầy.'
                : 'Tổng hợp doanh thu thanh toán và khoản hoàn theo dữ liệu hệ thống.'}
            </p>
          </div>
        </div>
      </header>
      <OwnerScopeGate scope={scope} prompt="Chọn khách sạn để tải số liệu trong module này." />
      {scope.hotelId && (
        <>
          <form className="owner-module__filters" onSubmit={setRange}>
            <label>
              Từ ngày
              <DateField type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              Đến ngày
              <DateField type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} />
            </label>
            <Button variant="secondary">Áp dụng khoảng ngày</Button>
          </form>
          {analytics.isLoading ? (
            <div role="status" className="owner-scope-state">
              Đang tải dữ liệu…
            </div>
          ) : analytics.isError || !data ? (
            <div role="alert" className="owner-scope-state is-error">
              {analytics.error instanceof ApiError ? analytics.error.message : 'Không thể tải dữ liệu phân tích.'}
            </div>
          ) : reports ? (
            <>
              <section className="owner-metric-strip">
                <article>
                  <small>Tổng đặt phòng</small>
                  <strong>{data.TongSoBooking.toLocaleString('vi-VN')}</strong>
                </article>
                <article>
                  <small>Tỷ lệ lấp đầy</small>
                  <strong>{data.TyLeLapDay === null ? 'Chưa có dữ liệu' : `${data.TyLeLapDay}%`}</strong>
                  <span>
                    {data.TongPhongDem.toLocaleString('vi-VN')} / {data.TongPhongCoTheBan.toLocaleString('vi-VN')} phòng-đêm
                  </span>
                </article>
              </section>
              <div className="owner-module__report-grid">
                <section className="owner-module__data">
                  <h2>Đặt phòng theo trạng thái</h2>
                  <BarList
                    items={data.BookingTheoTrangThai.map((item) => ({ label: item.TrangThai, value: item.SoLuong }))}
                    emptyMessage="Chưa có đặt phòng trong khoảng thời gian này"
                  />
                </section>
                <section className="owner-module__data">
                  <h2>Loại phòng phổ biến</h2>
                  <BarList
                    items={data.LoaiPhongPhoBien.map((item) => ({ label: item.TenLoaiPhong, value: item.SoLuongDaDat }))}
                    emptyMessage="Chưa có dữ liệu loại phòng"
                  />
                </section>
              </div>
            </>
          ) : (
            <>
              <section className="owner-revenue-total">
                <span>Doanh thu thực nhận</span>
                <strong>{formatCurrencyVND(data.DoanhThuThucNhan)}</strong>
                <small>
                  Doanh thu gộp {formatCurrencyVND(data.DoanhThuGop)} · Hoàn tiền {formatCurrencyVND(data.TongHoanTien)}
                </small>
              </section>
              <section className="owner-module__data">
                <h2>Tổng hợp trong kỳ</h2>
                <dl className="owner-revenue-breakdown">
                  <div>
                    <dt>Doanh thu gộp</dt>
                    <dd>{formatCurrencyVND(data.DoanhThuGop)}</dd>
                  </div>
                  <div>
                    <dt>Đã hoàn tiền</dt>
                    <dd>{formatCurrencyVND(data.TongHoanTien)}</dd>
                  </div>
                  <div>
                    <dt>Doanh thu thực nhận</dt>
                    <dd>{formatCurrencyVND(data.DoanhThuThucNhan)}</dd>
                  </div>
                </dl>
                <p className="owner-module__note">
                  API hiện cung cấp số tổng hợp theo kỳ, chưa có chuỗi doanh thu theo ngày hoặc giao dịch chi tiết.
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
