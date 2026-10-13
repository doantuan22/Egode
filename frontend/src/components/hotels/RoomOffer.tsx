import { useState } from 'react';
import type { RoomTypeWithAvailability } from '../../features/hotels/types';
import { formatCurrencyVND } from '../../lib/utils';
import { Icon } from '../common/Icon';
import { QuantityStepper } from '../common/QuantityStepper';
import { RoomDetailDialog } from './RoomDetailDialog';

export function RoomOffer({ room, selectedQuantity, onQuantityChange }: {
  room: RoomTypeWithAvailability;
  selectedQuantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const cover = room.HinhAnh.find((image) => image.LaAnhDaiDien) ?? room.HinhAnh[0];
  const amenities = room.TienNghi.slice(0, 4);
  return (
    <article className={`room-offer ${selectedQuantity > 0 ? 'is-selected' : ''} ${!room.ConHang ? 'is-unavailable' : ''}`}>
      <div className="room-offer__media">
        {cover ? <img src={cover.URL} alt="" width={205} height={180} loading="lazy" decoding="async" /> : <span aria-hidden="true"><i className="ph ph-bed" /></span>}
      </div>
      <div className="room-offer__details">
        <h3>{room.TenLoaiPhong}</h3>
        <p className="room-offer__facts"><span>{room.DienTich} m²</span><span>{room.LoaiGiuong}</span><span>Tối đa {room.SucChua} khách</span></p>
        {room.MoTa && <p className="room-offer__description">{room.MoTa}</p>}
        {amenities.length > 0 && <ul className="room-offer__amenities" aria-label="Tiện nghi nổi bật">{amenities.map((amenity) => <li key={amenity.MaTienNghi}>{amenity.TenTienNghi}</li>)}</ul>}
        <p className={`room-offer__availability ${room.ConHang ? 'is-available' : 'is-unavailable'}`}>{room.ConHang ? `Còn ${room.SoPhongConLai} phòng` : 'Hết phòng theo ngày đã chọn'}</p>
        <button type="button" className="room-offer__more" aria-label={`Xem chi tiết phòng ${room.TenLoaiPhong}`} aria-haspopup="dialog" onClick={() => setDetailOpen(true)}>
          <Icon name="info" size={16} />
          Xem chi tiết phòng
        </button>
      </div>
      <div className="room-offer__selection">
        {room.GiaTheoDem !== null ? <><strong>{formatCurrencyVND(room.GiaTheoDem)}</strong><span>/ phòng / đêm</span>{room.TongTien !== null && <small>{formatCurrencyVND(room.TongTien)} cho {room.SoDem} đêm</small>}</> : <span>Chưa có giá</span>}
        <label>Số phòng</label>
        <QuantityStepper label={`phòng ${room.TenLoaiPhong}`} min={0} max={room.SoPhongConLai} disabled={!room.ConHang} value={selectedQuantity} onChange={onQuantityChange} />
      </div>
      <RoomDetailDialog room={room} open={detailOpen} onClose={() => setDetailOpen(false)} selectedQuantity={selectedQuantity} onQuantityChange={onQuantityChange} />
    </article>
  );
}
