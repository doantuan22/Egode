/**
 * The ONE place that turns the database's date/time columns into business moments.
 *
 * Business time zone: Asia/Ho_Chi_Minh (UTC+7, no daylight saving). How the data is stored:
 *   - DATE columns (NgayNhanPhong, NgayTraPhong, NgayApDung, KHUYEN_MAI.NgayBatDau/NgayKetThuc) are calendar
 *     days; Prisma hands them over as the UTC midnight of that day, so their "date key" is the UTC calendar day;
 *   - TIME columns (KHACH_SAN.GioNhanPhong/GioTraPhong) are wall-clock times of the hotel, handed over as
 *     1970-01-01T<HH:mm>Z, so the time of day is the UTC clock part;
 *   - timestamps (NgayTao, ThoiGianGiaoDich, NgayHoanTien, …) are real instants, stored in UTC.
 * A business rule such as "cancel 48 h before check-in" is about the check-in INSTANT: the stay's date plus the
 * hotel's check-in time, read in Vietnam time — never 00:00 UTC of the date.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** Vietnam does not observe daylight saving, so its offset is constant. */
export const BUSINESS_UTC_OFFSET = '+07:00';
export const BUSINESS_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in the business time zone, as `YYYY-MM-DD`. */
export const businessToday = (now: Date = new Date()): string => businessDateFormat.format(now);

/** The calendar day of a DATE column value, as `YYYY-MM-DD`. */
export const dateKeyOf = (date: Date): string => date.toISOString().slice(0, 10);

/** `YYYY-MM-DD` shifted by a number of days (negative = earlier). */
export const addDaysToDateKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** The wall-clock time of a TIME column value, as `HH:mm`. */
export const timeOfDayOf = (time: Date): string => time.toISOString().slice(11, 16);

/** The instant at which the business day `YYYY-MM-DD` starts (00:00 in Vietnam). */
export const businessDayStart = (dateKey: string): Date => new Date(`${dateKey}T00:00:00${BUSINESS_UTC_OFFSET}`);

/** The instant of a Vietnam wall-clock moment: `YYYY-MM-DD` + `HH:mm`. */
export const businessInstant = (dateKey: string, hhmm: string): Date => new Date(`${dateKey}T${hhmm}:00${BUSINESS_UTC_OFFSET}`);

/** When guests may check in: the stay's date at the hotel's check-in time (Vietnam time). */
export const checkInInstant = (ngayNhanPhong: Date, gioNhanPhong: Date): Date => businessInstant(dateKeyOf(ngayNhanPhong), timeOfDayOf(gioNhanPhong));

/** When guests must have left: the stay's last date at the hotel's check-out time (Vietnam time). */
export const checkOutInstant = (ngayTraPhong: Date, gioTraPhong: Date): Date => businessInstant(dateKeyOf(ngayTraPhong), timeOfDayOf(gioTraPhong));

/** Hours from `now` until `instant` (negative once it has passed). */
export const hoursUntil = (instant: Date, now: Date = new Date()): number => (instant.getTime() - now.getTime()) / MS_PER_HOUR;
