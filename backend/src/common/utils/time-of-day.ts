import { z } from 'zod';

/** Giờ nhận/trả phòng luôn là chuỗi HH:mm */
export const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Chuyển HH:mm thành Date để lưu vào cột TIME */
export const timeOfDaySchema = z
  .string()
  .regex(HHMM_PATTERN, 'Giờ phải theo định dạng HH:MM')
  .transform((value) => new Date(`1970-01-01T${value}:00Z`));

const TIME_COLUMN_ISO = /^1970-01-01T(\d{2}:\d{2}):00\.000Z$/;
const TIME_FIELDS = new Set(['GioNhanPhong', 'GioTraPhong']);

/** Ghi giờ nhận/trả phòng trong JSON trả về dạng HH:mm */
export const timeOfDayJsonReplacer = (key: string, value: unknown): unknown => {
  if (TIME_FIELDS.has(key) && typeof value === 'string') {
    const match = TIME_COLUMN_ISO.exec(value);
    if (match) return match[1];
  }
  return value;
};
