import { Link } from 'react-router-dom';
import type { HotelSearchItem } from '../../features/hotels/types';
import { formatCurrencyVND } from '../../lib/utils';
import { formatRating } from '../../features/reviews/rating';

/** Result row ordered around the information the current hotel API supplies. */
export function HotelCard({ hotel, search }: { hotel: HotelSearchItem; search: string }) {
  const detailUrl = `/hotels/${hotel.MaKhachSan}?${search}`;
  return (
    <article className="hotel-card-v2">
      <Link className="hotel-card-v2__media" to={detailUrl} aria-label={`Xem phòng tại ${hotel.TenKhachSan}`}>
        {hotel.AnhDaiDien ? <img src={hotel.AnhDaiDien} alt="" width={320} height={240} loading="lazy" decoding="async" /> : <span className="hotel-card-v2__fallback" aria-hidden="true"><i className="ph ph-image" /></span>}
      </Link>
      <div className="hotel-card-v2__identity">
        <div className="hotel-card-v2__title-row"><h2><Link to={detailUrl}>{hotel.TenKhachSan}</Link></h2>{hotel.HangSao > 0 && <span className="hotel-card-v2__stars" role="img" aria-label={`${hotel.HangSao} sao`}>{'★'.repeat(Math.min(5, hotel.HangSao))}</span>}</div>
        {(hotel.SoLuongDanhGia ?? 0) > 0 && (
          <p className="hotel-card-v2__rating"><strong>{formatRating(hotel.DiemTrungBinh ?? null)}</strong>/5 · {hotel.SoLuongDanhGia} đánh giá</p>
        )}
        <p className="hotel-card-v2__location"><i className="ph ph-map-pin" aria-hidden="true" />{hotel.DiaPhuong.TenThanhPho}</p>
        <p className={`hotel-card-v2__availability ${hotel.ConPhong ? 'is-available' : 'is-unavailable'}`}>{hotel.ConPhong ? 'Còn phòng theo ngày đã chọn' : 'Hết phòng theo ngày đã chọn'}</p>
      </div>
      <div className="hotel-card-v2__commercial">
        {hotel.GiaTuDauTu !== null ? <><span className="hotel-card-v2__price-label">Giá từ / đêm</span><strong>{formatCurrencyVND(hotel.GiaTuDauTu)}</strong></> : <span className="hotel-card-v2__price-label">Chưa có giá để hiển thị</span>}
        <Link to={detailUrl} className="hotel-card-v2__action">{hotel.ConPhong ? 'Xem phòng' : 'Xem khách sạn'} <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
