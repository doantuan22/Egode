/**
 * Pure availability/pricing computation (BE-4, read-only).
 *
 * Business rules (M2 §4):
 * - A stay is the half-open interval [NgayNhanPhong, NgayTraPhong) — the
 *   checkout date itself is never counted as a night.
 * - available(night) = QUY_PHONG_GIA.SoLuongPhong(night) - booked(night),
 *   where booked(night) sums CHI_TIET_DAT_PHONG.SoLuongPhong for bookings
 *   whose stay covers that night and whose DAT_PHONG.TrangThai is not
 *   "Đã hủy" (cancelled bookings never occupy inventory).
 * - A room type's availability for the whole requested range is the
 *   minimum across every night in range (the bottleneck night). A night
 *   with no QUY_PHONG_GIA row at all is treated as 0 available for that
 *   night (nothing to sell without a price/inventory record).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateOnlyUTC = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const toDateKey = (date: Date): string => toDateOnlyUTC(date).toISOString().slice(0, 10);

/** [checkIn, checkOut) — checkout night itself is excluded. Throws if checkOut <= checkIn. */
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

/**
 * Rooms of a room type that exist on EVERY night of the stay (the smallest nightly stock), regardless of what is
 * booked; 0 if any night has no stock row at all. The ceiling on how many rooms of it one stay could use.
 */
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
  /** Available room count for the whole stay (bottleneck night). Never negative. */
  available: number;
  /** Nightly price for each night that had a rate row, in stay order. */
  pricePerNight: number[];
  /** Sum of nightly prices for one room, or null if any night is unpriced (no rate row). */
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
  /** Rooms of this type still free across the whole stay (bottleneck night). */
  available: number;
  /** available >= the quantity requested for this line. */
  duPhong: boolean;
  /** Every night in the stay had a QUY_PHONG_GIA row (fully priceable). */
  coGiaDayDu: boolean;
  giaTheoDem: number | null;
  /** Total for `soLuong` rooms across the whole stay, or null if unpriced. */
  thanhTien: number | null;
}

/**
 * One room line's availability + price, for `soLuong` rooms. Shared by the
 * Quote (M4) and Booking (M5) flows so both always price a line identically —
 * Booking still re-fetches its own rates/booked-counts independently (inside
 * a locked transaction) rather than trusting a client-supplied quote.
 */
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

/**
 * Sums, per calendar night, how many rooms of a given room type are already
 * occupied by non-cancelled bookings overlapping that night.
 */
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
