import { z } from 'zod';

/** Quy tắc số điện thoại: dấu + tùy chọn rồi 8 đến 15 chữ số */
export const phoneNumberSchema = z.string().trim().regex(/^\+?[0-9]{8,15}$/, 'Số điện thoại không hợp lệ');
