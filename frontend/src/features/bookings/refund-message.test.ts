import { describe, expect, it } from 'vitest';
import { summarizeRefund } from './refund-message';
import type { BookingDetail } from './types';

const refund = (TrangThai: string, SoTienHoan: number) => ({ MaHoanTien: 1, SoTienHoan, LyDoHoanTien: '', TrangThai, NgayYeuCau: '', NgayHoanTien: null });
const booking = (payments: Array<{ TrangThai: string; method?: string; refunds?: ReturnType<typeof refund>[] }>) =>
  ({
    ThanhToan: payments.map((p, i) => ({ MaThanhToan: i + 1, SoTien: 1000000, PhuongThucThanhToan: p.method ?? 'VNPAY (mô phỏng)', TrangThai: p.TrangThai, ThoiGianGiaoDich: '', HoanTien: p.refunds ?? [] })),
  }) as unknown as Pick<BookingDetail, 'ThanhToan'>;

describe('summarizeRefund — what a cancelled, paid booking got back', () => {
  it('a completed refund: the amount and the original payment method', () => {
    expect(summarizeRefund(booking([{ TrangThai: 'Thành công', refunds: [refund('Thành công', 750000)] }]))).toEqual({ kind: 'refunded', amount: 750000, method: 'VNPAY (mô phỏng)' });
  });

  it('no refund row at all (0 % tier): nothing is refunded', () => {
    expect(summarizeRefund(booking([{ TrangThai: 'Thành công' }]))).toEqual({ kind: 'none', amount: 0, method: 'VNPAY (mô phỏng)' });
  });

  it.each(['Thất bại', 'Chờ xử lý'])('a refund that is %s is "unfinished", never reported as money returned', (status) => {
    const result = summarizeRefund(booking([{ TrangThai: 'Thành công', refunds: [refund(status, 1000000)] }]));
    expect(result.kind).toBe('unfinished');
    expect(result.amount).toBe(0);
  });

  it('only payments that succeeded count (a failed attempt has no refund and gives no method)', () => {
    const result = summarizeRefund(booking([{ TrangThai: 'Thất bại', method: 'VNPAY' }, { TrangThai: 'Thành công', method: 'VNPAY (mô phỏng)', refunds: [refund('Thành công', 400000)] }]));
    expect(result).toEqual({ kind: 'refunded', amount: 400000, method: 'VNPAY (mô phỏng)' });
  });

  it('no payments: nothing, no method', () => {
    expect(summarizeRefund(booking([]))).toEqual({ kind: 'none', amount: 0, method: null });
  });
});
