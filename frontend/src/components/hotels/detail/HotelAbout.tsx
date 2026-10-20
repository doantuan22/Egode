import type { HotelDetail } from '../../../features/hotels/types';
import { Card } from '../../common/Card';
import { Icon } from '../../common/Icon';

/** Phần Tổng quan gồm mô tả và vài tiện nghi đầu */
export function HotelOverview({ hotel }: { hotel: HotelDetail }) {
  return (
    <section id="tong-quan" className="pt-2 scroll-mt-36">
      <Card className="sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mb-4 flex items-center gap-2.5">
          <Icon name="info" size={24} className="text-primary" />
          Tổng quan về {hotel.TenKhachSan}
        </h2>
        <p className="text-ink-muted text-sm sm:text-base leading-relaxed mb-4 whitespace-pre-line">
          {hotel.MoTa ?? 'Khách sạn chưa cập nhật mô tả chi tiết.'}
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
          {hotel.TienNghi.slice(0, 4).map((a) => (
            <li key={a.MaTienNghi} className="p-3 bg-surface-secondary rounded-xl flex items-center gap-3">
              <Icon name="check-circle" className="text-lg text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-ink">{a.TenTienNghi}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/** Phần Tiện nghi và Dịch vụ */
export function HotelAmenities({ hotel }: { hotel: HotelDetail }) {
  return (
    <section id="tien-nghi" className="pt-2 scroll-mt-36">
      <Card className="sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mb-6 flex items-center gap-2">
          <Icon name="sparkle" size={24} className="text-primary" />
          Tiện nghi & Dịch vụ khách sạn
        </h2>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {hotel.TienNghi.map((a) => (
            <li key={a.MaTienNghi} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-secondary transition-colors">
              <Icon name="check-circle" className="text-xl text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-ink">{a.TenTienNghi}</span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
