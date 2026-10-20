/** Chuyển các cột ngày giờ của CSDL thành thời điểm nghiệp vụ theo giờ Việt Nam */
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** Việt Nam không có giờ mùa hè nên độ lệch múi giờ cố định */
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

/** Ngày hiện tại theo múi giờ nghiệp vụ, dạng YYYY-MM-DD */
export const businessToday = (now: Date = new Date()): string => businessDateFormat.format(now);

/** Ngày lịch của giá trị cột DATE, dạng YYYY-MM-DD */
export const dateKeyOf = (date: Date): string => date.toISOString().slice(0, 10);

/** Dịch ngày YYYY-MM-DD đi một số ngày */
export const addDaysToDateKey = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** Giờ trên tường của giá trị cột TIME, dạng HH:mm */
export const timeOfDayOf = (time: Date): string => time.toISOString().slice(11, 16);

/** Thời điểm bắt đầu ngày nghiệp vụ (00:00 giờ Việt Nam) */
export const businessDayStart = (dateKey: string): Date => new Date(`${dateKey}T00:00:00${BUSINESS_UTC_OFFSET}`);

/** Thời điểm của một ngày giờ Việt Nam */
export const businessInstant = (dateKey: string, hhmm: string): Date => new Date(`${dateKey}T${hhmm}:00${BUSINESS_UTC_OFFSET}`);

/** Thời điểm được phép nhận phòng */
export const checkInInstant = (ngayNhanPhong: Date, gioNhanPhong: Date): Date => businessInstant(dateKeyOf(ngayNhanPhong), timeOfDayOf(gioNhanPhong));

/** Thời điểm phải trả phòng */
export const checkOutInstant = (ngayTraPhong: Date, gioTraPhong: Date): Date => businessInstant(dateKeyOf(ngayTraPhong), timeOfDayOf(gioTraPhong));

/** Số giờ từ hiện tại đến một thời điểm */
export const hoursUntil = (instant: Date, now: Date = new Date()): number => (instant.getTime() - now.getTime()) / MS_PER_HOUR;
