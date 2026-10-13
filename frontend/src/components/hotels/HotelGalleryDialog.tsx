import { useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';

interface GalleryImage {
  MaHinhAnh: number;
  URL: string;
}

/**
 * Full photo list of a hotel in a native modal <dialog> (focus trap, Esc to close and
 * inert background come from the browser). It is open while `startIndex` is a number,
 * and scrolls that photo into view; `onClose` fires however it was closed.
 */
export function HotelGalleryDialog({ hotelName, images, startIndex, onClose }: {
  hotelName: string;
  images: GalleryImage[];
  startIndex: number | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const isOpen = startIndex !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!isOpen && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [isOpen]);

  useEffect(() => {
    if (startIndex === null) return;
    const frame = requestAnimationFrame(() => itemRefs.current[startIndex]?.scrollIntoView?.({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [startIndex]);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === 'function') dialog.close(); // fires the native 'close' event -> onClose
    else {
      dialog?.removeAttribute('open');
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Ảnh ${hotelName}`}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      className="m-auto max-h-[92vh] w-[min(96vw,65rem)] overflow-hidden rounded-2xl border border-border bg-white p-0 shadow-xl backdrop:bg-black/70"
    >
      {isOpen && (
        <div className="flex max-h-[92vh] flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <h2 className="truncate text-base font-semibold text-ink">{hotelName} · {images.length} ảnh</h2>
            <button type="button" className="btn btn-icon btn-ghost" aria-label="Đóng thư viện ảnh" onClick={requestClose}><Icon name="x" size={20} /></button>
          </header>
          <ul className="grid gap-3 overflow-y-auto p-4">
            {images.map((image, index) => (
              <li key={image.MaHinhAnh} ref={(node) => { itemRefs.current[index] = node; }}>
                <img src={image.URL} alt={`Ảnh ${index + 1} / ${images.length}`} loading="lazy" decoding="async" className="w-full rounded-xl object-cover" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </dialog>
  );
}
