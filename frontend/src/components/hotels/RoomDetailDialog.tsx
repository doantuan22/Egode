import { useEffect, useRef, useState } from 'react';
import type { RoomTypeWithAvailability } from '../../features/hotels/types';
import { cn, formatCurrencyVND } from '../../lib/utils';
import { Icon } from '../common/Icon';
import { QuantityStepper } from '../common/QuantityStepper';

/** Hộp thoại chi tiết loại phòng gồm ảnh, mô tả, tiện nghi và chọn số phòng */
export function RoomDetailDialog({ room, open, onClose, selectedQuantity, onQuantityChange }: {
  room: RoomTypeWithAvailability;
  open: boolean;
  onClose: () => void;
  selectedQuantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === 'function') dialog.close();
    else {
      dialog?.removeAttribute('open');
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Chi tiết ${room.TenLoaiPhong}`}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      className="m-auto max-h-[92vh] w-[min(96vw,56rem)] overflow-hidden rounded-2xl border border-border bg-white p-0 shadow-xl backdrop:bg-black/70"
    >
      {open && <RoomDetailBody room={room} onClose={requestClose} selectedQuantity={selectedQuantity} onQuantityChange={onQuantityChange} />}
    </dialog>
  );
}

function RoomDetailBody({ room, onClose, selectedQuantity, onQuantityChange }: {
  room: RoomTypeWithAvailability;
  onClose: () => void;
  selectedQuantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  // Ảnh bìa đứng đầu
  const images = [...room.HinhAnh].sort((a, b) => Number(b.LaAnhDaiDien) - Number(a.LaAnhDaiDien));
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];
  const facts = [
    { icon: 'ruler', label: 'Diện tích', value: `${room.DienTich} m²` },
    { icon: 'bed', label: 'Loại giường', value: room.LoaiGiuong },
    { icon: 'stack', label: 'Số giường', value: String(room.SoGiuong) },
    { icon: 'users', label: 'Sức chứa', value: `Tối đa ${room.SucChua} khách` },
  ];

  return (
    <div className="flex max-h-[92vh] flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <h2 className="truncate text-base font-semibold text-ink">{room.TenLoaiPhong}</h2>
        <button type="button" className="btn btn-icon btn-ghost" aria-label="Đóng chi tiết phòng" onClick={onClose}><Icon name="x" size={20} /></button>
      </header>

      <div className="grid gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-label="Hình ảnh phòng" className="space-y-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-tertiary">
            {active ? (
              <img src={active.URL} alt={`Ảnh ${activeIndex + 1} / ${images.length} của ${room.TenLoaiPhong}`} decoding="async" className="h-full w-full object-cover" />
            ) : (
              <span aria-label="Chưa có ảnh" className="grid h-full place-items-center text-3xl text-ink-muted"><Icon name="bed" /></span>
            )}
          </div>
          {images.length > 1 && (
            <ul className="grid grid-cols-5 gap-2">
              {images.map((image, index) => (
                <li key={image.MaHinhAnhLoaiPhong}>
                  <button
                    type="button"
                    aria-label={`Xem ảnh ${index + 1}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 transition',
                      index === activeIndex ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'
                    )}
                  >
                    <img src={image.URL} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-5">
          <dl className="grid grid-cols-2 gap-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-start gap-2.5 rounded-xl bg-surface-secondary px-3 py-2.5">
                <Icon name={fact.icon} size={20} className="mt-0.5 text-primary" />
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">{fact.label}</dt>
                  <dd className="text-sm font-semibold text-ink">{fact.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">Mô tả</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-sub">{room.MoTa?.trim() || 'Khách sạn chưa cập nhật mô tả cho loại phòng này.'}</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-ink">Tiện nghi trong phòng</h3>
            {room.TienNghi.length > 0 ? (
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm text-ink-sub sm:grid-cols-2">
                {room.TienNghi.map((amenity) => (
                  <li key={amenity.MaTienNghi} className="flex items-center gap-2">
                    <Icon name="check" size={16} className="text-success-ink" />
                    {amenity.TenTienNghi}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Chưa có thông tin tiện nghi.</p>
            )}
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-secondary px-5 py-3">
        <div className="min-w-0">
          {room.GiaTheoDem !== null ? (
            <>
              <p className="text-lg font-bold text-ink">{formatCurrencyVND(room.GiaTheoDem)} <span className="text-xs font-normal text-ink-muted">/ phòng / đêm</span></p>
              {room.TongTien !== null && <p className="text-xs text-ink-sub">{formatCurrencyVND(room.TongTien)} cho {room.SoDem} đêm</p>}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Chưa có giá</p>
          )}
          <p className={cn('mt-0.5 text-xs font-semibold', room.ConHang ? 'text-success-ink' : 'text-ink-muted')}>
            {room.ConHang ? `Còn ${room.SoPhongConLai} phòng` : 'Hết phòng theo ngày đã chọn'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-ink-sub">Số phòng</span>
          <QuantityStepper label={`phòng ${room.TenLoaiPhong} (chi tiết)`} min={0} max={room.SoPhongConLai} disabled={!room.ConHang} value={selectedQuantity} onChange={onQuantityChange} />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {selectedQuantity > 0 ? 'Xong' : 'Đóng'}
          </button>
        </div>
      </footer>
    </div>
  );
}
