import { z } from 'zod';

/**
 * The ONE contract for a hotel's check-in / check-out time, in both directions and for every role:
 *   GioNhanPhong, GioTraPhong  =  "HH:mm"   (24-hour wall-clock time of the hotel, Vietnam time)
 * The columns are SQL TIME; Prisma reads them as 1970-01-01T<HH:mm>Z, which is an implementation detail that must
 * never reach a client (nor be accepted from one: no `z.coerce.date()`, no ISO strings).
 */
export const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Request side: "HH:mm" → the Date Prisma stores in a TIME column. */
export const timeOfDaySchema = z
  .string()
  .regex(HHMM_PATTERN, 'Giờ phải theo định dạng HH:MM')
  .transform((value) => new Date(`1970-01-01T${value}:00Z`));

const TIME_COLUMN_ISO = /^1970-01-01T(\d{2}:\d{2}):00\.000Z$/;
const TIME_FIELDS = new Set(['GioNhanPhong', 'GioTraPhong']);

/**
 * Response side, for every JSON the API sends (`app.set('json replacer', …)`): a GioNhanPhong / GioTraPhong that
 * came out of a TIME column is written as "HH:mm". Admin, owner, public, nested hotel rows — all the same.
 */
export const timeOfDayJsonReplacer = (key: string, value: unknown): unknown => {
  if (TIME_FIELDS.has(key) && typeof value === 'string') {
    const match = TIME_COLUMN_ISO.exec(value);
    if (match) return match[1];
  }
  return value;
};
