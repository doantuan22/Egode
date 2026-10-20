import type { Quote, QuoteRequest } from './types';

/** Kiểm tra báo giá có đúng ngày và phòng đang chọn */
export function quoteMatchesRequest(quote: Quote | undefined, request: Pick<QuoteRequest, 'checkIn' | 'checkOut' | 'rooms'>): boolean {
  if (!quote || quote.NgayNhanPhong !== request.checkIn || quote.NgayTraPhong !== request.checkOut) return false;
  if (quote.ChiTietPhong.length !== request.rooms.length) return false;
  return request.rooms.every((line) =>
    quote.ChiTietPhong.some((quotedLine) => quotedLine.MaLoaiPhong === line.maLoaiPhong && quotedLine.SoLuongYeuCau === line.soLuong)
  );
}
