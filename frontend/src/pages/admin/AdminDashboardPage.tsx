import { Link } from 'react-router-dom';
import { Icon } from '../../components/common/Icon';
import { PageHeader } from '../../components/common/PageHeader';
import { PageSpinner } from '../../components/common/PageSpinner';
import { useAdminAnalytics } from '../../features/analytics/hooks';
import { useAdminPartnerApplications } from '../../features/partners/hooks';
import type { CountByLabel } from '../../features/analytics/types';
import { formatCurrencyVND } from '../../lib/utils';
import { ApiError } from '../../services/apiClient';

interface ManagementLink {
  to: string;
  title: string;
  detail: string;
  icon: string;
}

const reviewLinks: ManagementLink[] = [
  { to: '/admin/partner-applications', title: 'Hồ sơ đối tác', detail: 'Thẩm định hồ sơ và điều kiện mở bán', icon: 'file-text' },
  { to: '/admin/hotels', title: 'Khách sạn', detail: 'Quản lý cơ sở lưu trú và trạng thái hoạt động', icon: 'buildings' },
  { to: '/admin/reviews', title: 'Đánh giá', detail: 'Kiểm duyệt nội dung và phản hồi vi phạm', icon: 'star' },
  { to: '/admin/support', title: 'Hỗ trợ & khiếu nại', detail: 'Theo dõi yêu cầu từ khách hàng và đối tác', icon: 'chat-text' },
  { to: '/admin/payments', title: 'Thanh toán', detail: 'Tra cứu giao dịch và tình trạng hoàn tiền', icon: 'credit-card' },
];

const platformLinks: ManagementLink[] = [
  { to: '/admin/accounts', title: 'Tài khoản', detail: 'Quản lý người dùng và quyền truy cập', icon: 'users' },
  { to: '/admin/promotions', title: 'Khuyến mãi', detail: 'Tạo và theo dõi chương trình ưu đãi', icon: 'percent' },
  { to: '/admin/analytics', title: 'Báo cáo & thống kê', detail: 'Theo dõi số liệu vận hành toàn nền tảng', icon: 'chart-bar' },
];

function ManagementPanel({ title, description, links }: { title: string; description: string; links: ManagementLink[] }) {
  const headingId = `admin-links-${title}`;
  return (
    <section className="admin-management-panel" aria-labelledby={headingId}>
      <div className="admin-management-panel__heading">
        <h2 id={headingId}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="admin-management-list">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="admin-management-list__item">
            <span className="admin-management-list__icon"><Icon name={link.icon} size={19} /></span>
            <span className="admin-management-list__copy">
              <strong>{link.title}</strong>
              <small>{link.detail}</small>
            </span>
            <Icon name="caret-right" size={16} className="admin-management-list__arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const countOf = (rows: CountByLabel[] | undefined, ...labels: string[]) =>
  rows ? rows.filter((row) => labels.includes(row.Label)).reduce((sum, row) => sum + row.SoLuong, 0) : undefined;

export default function AdminDashboardPage() {
  // Uses the existing audited aggregate endpoint. Detailed, date-filtered analysis stays in /admin/analytics.
  const analyticsQuery = useAdminAnalytics({});
  const analytics = analyticsQuery.data;
  const activeHotels = analytics?.KhachSanTheoTrangThai.find((item) => item.Label === 'Hoạt động')?.SoLuong ?? 0;
  // One row is enough: only the server-side total is read.
  const pendingApplications = useAdminPartnerApplications('Chờ duyệt', 1, 1);

  // Each tile opens the list already filtered to what is waiting (`status` is the filter every admin list reads from the URL).
  const queue = [
    {
      to: '/admin/partner-applications?status=Chờ duyệt',
      label: 'Hồ sơ đối tác chờ duyệt',
      hint: 'Cần thẩm định',
      count: pendingApplications.data?.pagination.total,
      icon: 'file-text',
      tone: 'blue',
    },
    {
      to: '/admin/support?status=Mới',
      label: 'Yêu cầu hỗ trợ mới',
      hint: 'Chưa tiếp nhận',
      count: countOf(analytics?.YeuCauHoTroTheoTrangThai, 'Mới', 'Mới tiếp nhận'),
      icon: 'lifebuoy',
      tone: 'amber',
    },
    {
      to: '/admin/reviews?status=Chờ duyệt',
      label: 'Đánh giá chờ kiểm duyệt',
      hint: 'Cần rà soát',
      count: countOf(analytics?.DanhGiaTheoTrangThai, 'Chờ duyệt'),
      icon: 'star',
      tone: 'violet',
    },
    {
      to: '/admin/reviews?status=Vi phạm',
      label: 'Đánh giá vi phạm chưa gỡ',
      hint: 'Cần xử lý',
      count: countOf(analytics?.DanhGiaTheoTrangThai, 'Vi phạm'),
      icon: 'warning-circle',
      tone: 'red',
    },
  ];

  const kpis = analytics
    ? [
        { label: 'Tổng tài khoản', value: analytics.TongTaiKhoan.toLocaleString('vi-VN'), hint: 'Người dùng hệ thống', icon: 'users-three', tone: 'blue' },
        { label: 'Khách sạn hoạt động', value: activeHotels.toLocaleString('vi-VN'), hint: 'Cơ sở đang mở bán', icon: 'buildings', tone: 'green' },
        { label: 'Tổng đặt phòng', value: analytics.TongSoBooking.toLocaleString('vi-VN'), hint: 'Booking ghi nhận', icon: 'calendar-check', tone: 'violet' },
        { label: 'Doanh thu thực nhận', value: formatCurrencyVND(analytics.DoanhThuThucNhan), hint: 'Giá trị đã ghi nhận', icon: 'wallet', tone: 'amber' },
      ]
    : [];

  return (
    <div className="admin-dashboard flex flex-col gap-8 max-w-[1200px] mx-auto w-full">
      <PageHeader
        title="Bảng điều khiển"
        description="Theo dõi tình trạng nền tảng, công việc cần xử lý và truy cập nhanh các khu vực quản trị."
        actions={
          <Link to="/admin/analytics" className="btn btn-outline btn-sm">
            <Icon name="chart-line-up" size={16} />
            <span>Xem báo cáo chi tiết</span>
          </Link>
        }
      />

      <section aria-labelledby="admin-attention-title" className="admin-dashboard__section">
        <h2 id="admin-attention-title" className="admin-dashboard__section-title">Cần xử lý</h2>
        <div className="admin-queue-grid">
          {queue.map((item) => (
            <Link key={item.to} to={item.to} className={`admin-queue-card admin-queue-card--${item.tone}`}>
              <span className="admin-queue-card__top">
                <span className="admin-tone-icon"><Icon name={item.icon} size={20} /></span>
                <Icon name="arrow-up-right" size={16} className="admin-queue-card__open" />
              </span>
              <strong className="admin-queue-card__value">{item.count === undefined ? '…' : item.count.toLocaleString('vi-VN')}</strong>
              <span className="admin-queue-card__label">{item.label}</span>
              <small>{item.hint}</small>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="admin-overview-title" className="admin-dashboard__section">
        <h2 id="admin-overview-title" className="admin-dashboard__section-title">Tổng quan hệ thống</h2>
        {analyticsQuery.isLoading ? (
          <PageSpinner />
        ) : analyticsQuery.isError || !analytics ? (
          <div role="alert" className="rounded-lg border border-danger bg-danger-light px-4 py-3 text-sm text-danger">
            {analyticsQuery.error instanceof ApiError ? analyticsQuery.error.message : 'Không thể tải số liệu tổng quan'}
          </div>
        ) : (
          <div className="admin-kpi-grid">
            {kpis.map((kpi) => (
              <article key={kpi.label} className={`admin-kpi-card admin-kpi-card--${kpi.tone}`}>
                <span className="admin-tone-icon"><Icon name={kpi.icon} size={22} /></span>
                <div>
                  <p>{kpi.label}</p>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.hint}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="admin-dashboard__domains">
        <ManagementPanel title="Rà soát & hỗ trợ" description="Các luồng cần kiểm duyệt hoặc xử lý thủ công." links={reviewLinks} />
        <ManagementPanel title="Vận hành nền tảng" description="Cấu hình và theo dõi hoạt động chung của hệ thống." links={platformLinks} />
      </div>

      <section className="admin-dashboard__note" aria-labelledby="admin-governance-note">
        <h2 id="admin-governance-note" className="text-sm font-semibold text-heading">Quy trình đối tác</h2>
        <p className="mt-1 text-sm text-ink-sub max-w-2xl">
          Phê duyệt hồ sơ cấp vai trò Chủ khách sạn; đăng ký từng cơ sở lưu trú được thực hiện trong luồng riêng.
        </p>
      </section>
    </div>
  );
}
