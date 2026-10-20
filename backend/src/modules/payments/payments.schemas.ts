import { z } from 'zod';

export const bookingIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const refundIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Dữ liệu từ VNPAY được kiểm tra bằng chữ ký */
export const vnpayCallbackQuerySchema = z.record(z.string(), z.unknown());
