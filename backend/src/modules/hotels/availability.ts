/** Tính số phòng trống và giá theo từng đêm lưu trú */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateOnlyUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const toDateKey = (date: Date): string => toDateOnlyUTC(date).toISOString().slice(0, 10);

/** Danh sách đêm lưu trú, không gồm ngày trả phòng */
export const enumerateNights = (checkIn: Date, checkOut: Date): string[] => {
  const start = toDateOnlyUTC(checkIn);
  const end = toDateOnlyUTC(checkOut);
  if (end.getTime() <= start.getTime()) {
    throw new Error('checkOut must be strictly after checkIn');
  }
  const nights: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += MS_PER_DAY) {
    nights.push(toDateKey(new Date(t)));
  }
  return nights;
};

/** Số phòng nhỏ nhất còn tồn kho qua mọi đêm */
export const stockForStay = (nightKeys: string[], rates: ReadonlyArray<{ NgayApDung: Date; SoLuongPhong: number }>): number => {
  if (nightKeys.length === 0) return 0;
  const byNight = new Map(rates.map((r) => [toDateKey(r.NgayApDung), r.SoLuongPhong]));
  let stock = Infinity;
  for (const key of nightKeys) {
    const rooms = byNight.get(key);
    if (rooms === undefined) return 0;
    stock = Math.min(stock, rooms);
  }
  return Number.isFinite(stock) ? stock : 0;
};

export interface NightlyRate {
  giaPhong: number;
  soLuongPhong: number;
}

export interface AvailabilityResult {
  /** Số phòng trống cho cả kỳ lưu trú */
  available: number;
  /** Giá từng đêm có dòng giá */
  pricePerNight: number[];
  /** Tổng giá một phòng cho cả kỳ, null nếu thiếu giá */
  totalPrice: number | null;
  nights: number;
}

export const computeRoomTypeAvailability = (
  nightKeys: string[],
  ratesByDate: ReadonlyMap<string, NightlyRate>,
  bookedByDate: ReadonlyMap<string, number>
): AvailabilityResult => {
  let available = Infinity;
  const pricePerNight: number[] = [];
  let fullyPriced = true;

  for (const key of nightKeys) {
    const rate = ratesByDate.get(key);
    const booked = bookedByDate.get(key) ?? 0;

    if (!rate) {
      available = 0;
      fullyPriced = false;
      continue;
    }
    pricePerNight.push(rate.giaPhong);
    const remaining = Math.max(0, rate.soLuongPhong - booked);
    available = Math.min(available, remaining);
  }

  if (nightKeys.length === 0) {
    available = 0;
  }

  return {
    available: Number.isFinite(available) ? available : 0,
    pricePerNight,
    totalPrice: fullyPriced ? pricePerNight.reduce((sum, p) => sum + p, 0) : null,
    nights: nightKeys.length,
  };
};

export interface RoomLinePricing {
  /** Số phòng còn trống qua cả kỳ lưu trú */
  available: number;
  /** Đủ số lượng yêu cầu */
  duPhong: boolean;
  /** Mọi đêm đều có giá */
  coGiaDayDu: boolean;
  giaTheoDem: number | null;
  /** Tổng giá cho số phòng yêu cầu */
  thanhTien: number | null;
}

/** Tính khả dụng và giá cho một dòng phòng, dùng chung cho báo giá và đặt phòng */
export const priceRoomLine = (
  nightKeys: string[],
  ratesByDate: ReadonlyMap<string, NightlyRate>,
  bookedByDate: ReadonlyMap<string, number>,
  soLuong: number
): RoomLinePricing => {
  const priced = computeRoomTypeAvailability(nightKeys, ratesByDate, bookedByDate);
  const coGiaDayDu = priced.totalPrice !== null;
  return {
    available: priced.available,
    duPhong: priced.available >= soLuong,
    coGiaDayDu,
    giaTheoDem: coGiaDayDu ? Math.round((priced.totalPrice as number) / priced.nights) : null,
    thanhTien: coGiaDayDu ? Math.round((priced.totalPrice as number) * soLuong) : null,
  };
};

/** Cộng số phòng đã bị chiếm theo từng đêm */
export const buildBookedByDate = (
  bookings: Array<{ ngayNhanPhong: Date; ngayTraPhong: Date; soLuongPhong: number }>
): Map<string, number> => {
  const bookedByDate = new Map<string, number>();
  for (const booking of bookings) {
    for (const night of enumerateNights(booking.ngayNhanPhong, booking.ngayTraPhong)) {
      bookedByDate.set(night, (bookedByDate.get(night) ?? 0) + booking.soLuongPhong);
    }
  }
  return bookedByDate;
};
