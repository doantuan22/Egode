import { z } from 'zod';
import { businessDayStart, dateKeyOf } from '../../common/utils/business-time';

/** A user-facing `to` is inclusive (e.g. "31/01" means through end of that day) — analytics.repository.ts always wants an exclusive upper bound, so add one day here, once, at the API boundary. */
export const toExclusiveEnd = (to: Date): Date => new Date(to.getTime() + 24 * 60 * 60 * 1000);

// `to` is inclusive, so from === to is a valid one-day range; only from > to is inverted.
// An inverted range used to pass and silently report an empty period (BUG-007).
export const dateRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from.getTime() <= q.to.getTime(), {
    message: 'Ngày bắt đầu (from) không được sau ngày kết thúc (to)',
    path: ['from'],
  });
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;

/**
 * The report filter is made of calendar days of the business time zone (Asia/Ho_Chi_Minh): "from 01/03" means from
 * 00:00 on 1 March IN VIETNAM. Timestamps in the database (NgayTao, ThoiGianGiaoDich, NgayHoanTien, NgayYeuCau) are
 * UTC instants, so before they are compared the days are turned into the instants at which those days start in
 * Vietnam (17:00 UTC of the day before). `to` must already be the EXCLUSIVE end (see toExclusiveEnd). Columns that
 * are themselves calendar days (NgayApDung, NgayNhanPhong, NgayTraPhong) are compared as plain days and must not
 * go through this.
 */
export const toBusinessInstantRange = (range: { from?: Date; to?: Date }): { from?: Date; to?: Date } => ({
  from: range.from ? businessDayStart(dateKeyOf(range.from)) : undefined,
  to: range.to ? businessDayStart(dateKeyOf(range.to)) : undefined,
});

/** `{ gte, lt }` over a timestamp column for a Vietnam-day range (see toBusinessInstantRange). */
export const businessInstantFilter = (range: { from?: Date; to?: Date }): { gte?: Date; lt?: Date } => {
  const { from, to } = toBusinessInstantRange(range);
  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
};
