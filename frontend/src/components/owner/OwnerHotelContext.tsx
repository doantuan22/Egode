import { Icon } from '../common/Icon';
import { Link } from 'react-router-dom';
import type { OwnerHotel } from '../../features/owner/types';
import { ApiError } from '../../services/apiClient';
import { Select } from '../common/Select';

export function OwnerHotelContextSelector({ hotels, hotelId, onChange, compact = false }: {
  hotels: OwnerHotel[];
  hotelId: number | null;
  onChange: (hotelId: string) => void;
  compact?: boolean;
}) {
  if (hotels.length <= 1) {
    const hotel = hotels[0];
    return hotel ? <div className="owner-hotel-context" aria-label="Khách sạn đang chọn"><Icon name="buildings" size={18} /><span><small>Khách sạn</small><strong>{hotel.TenKhachSan}</strong></span></div> : null;
  }
  return <label data-select-anchor className={`owner-hotel-context owner-hotel-context--select${compact ? ' is-compact' : ''}`}>
    <Icon name="buildings" size={18} />
    <span><small>Phạm vi khách sạn</small><Select aria-label="Chọn khách sạn" value={hotelId ? String(hotelId) : ''} onChange={(event) => onChange(event.target.value)}>
      {!hotelId && <option value="">Chọn khách sạn</option>}
      {hotels.map((hotel) => <option key={hotel.MaKhachSan} value={hotel.MaKhachSan}>{hotel.TenKhachSan}</option>)}
    </Select></span>
  </label>;
}

export function OwnerHotelScopeState({ loading, error, empty, invalid }: { loading: boolean; error?: unknown; empty: boolean; invalid: boolean }) {
  if (loading) return <div className="owner-scope-state" role="status">Đang tải phạm vi khách sạn…</div>;
  if (error) return <div className="owner-scope-state is-error" role="alert">{error instanceof ApiError ? error.message : 'Không thể tải khách sạn của bạn.'}</div>;
  if (empty) return <div className="owner-scope-state"><Icon name="bed" size={22} /><strong>Chưa có khách sạn để vận hành</strong><span>Tạo hồ sơ khách sạn để bắt đầu quản lý phòng và đặt phòng.</span><Link to="/owner/hotels/new" className="btn btn-primary">Thêm khách sạn</Link></div>;
  if (invalid) return <div className="owner-scope-state" role="status">Khách sạn trong liên kết không còn khả dụng. Đã làm mới phạm vi dữ liệu.</div>;
  return null;
}
