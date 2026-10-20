import { z } from 'zod';
import { businessDayStart, dateKeyOf } from '../../common/utils/business-time';

/** Chuyển ngày kết thúc bao gồm thành cận trên loại trừ */
export const toExclusiveEnd = (to: Date): Date => new Date(to.getTime() + 24 * 60 * 60 * 1000);

// Khoảng ngày hợp lệ khi from không lớn hơn to
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

/** Chuyển khoảng ngày giờ Việt Nam thành khoảng thời điểm UTC */
export const toBusinessInstantRange = (range: { from?: Date; to?: Date }): { from?: Date; to?: Date } => ({
  from: range.from ? businessDayStart(dateKeyOf(range.from)) : undefined,
  to: range.to ? businessDayStart(dateKeyOf(range.to)) : undefined,
});

/** Điều kiện gte/lt trên cột thời gian */
export const businessInstantFilter = (range: { from?: Date; to?: Date }): { gte?: Date; lt?: Date } => {
  const { from, to } = toBusinessInstantRange(range);
  return { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
};
