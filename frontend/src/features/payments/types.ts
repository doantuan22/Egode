import type { PaymentView } from '../bookings/types';

export interface CreatePaymentResponse {
  maThanhToan: number;
  maGiaoDichDoiTac: string;
  paymentUrl: string;
}

export interface PaymentStatusResponse {
  MaDatPhong: number;
  MaXacNhanDatPhong: string;
  TrangThaiDatPhong: string;
  ThanhToan: PaymentView[];
}

export type PaymentProvider = 'simulated' | 'vnpay';

export interface PaymentConfig {
  provider: PaymentProvider;
}

/** POST /bookings/:id/payments/simulate — the payment is already recorded and the booking confirmed. */
export interface SimulatedPaymentResponse {
  maThanhToan: number;
  maGiaoDichDoiTac: string;
  maDatPhong: number;
  maXacNhanDatPhong: string;
  soTien: number;
  trangThaiThanhToan: string;
  trangThaiDatPhong: string;
  thoiGianThanhToan: string;
}
