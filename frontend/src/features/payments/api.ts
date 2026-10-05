import { apiClient } from '../../services/apiClient';
import type { RefundView } from '../bookings/types';
import type { CreatePaymentResponse, PaymentConfig, PaymentStatusResponse, SimulatedPaymentResponse } from './types';

export const createVnpayPayment = async (bookingId: number): Promise<CreatePaymentResponse> => {
  const res = await apiClient<CreatePaymentResponse>(`/bookings/${bookingId}/payments/vnpay`, { method: 'POST' });
  return res.data as CreatePaymentResponse;
};

export const getPaymentStatus = async (bookingId: number): Promise<PaymentStatusResponse> => {
  const res = await apiClient<PaymentStatusResponse>(`/bookings/${bookingId}/payments/status`);
  return res.data as PaymentStatusResponse;
};

export const retryRefund = async (refundId: number): Promise<RefundView> => {
  const res = await apiClient<RefundView>(`/payments/refunds/${refundId}/retry`, { method: 'POST' });
  return res.data as RefundView;
};

export const getPaymentConfig = async (): Promise<PaymentConfig> => {
  const res = await apiClient<PaymentConfig>('/payments/config');
  return res.data as PaymentConfig;
};

export const paySimulated = async (bookingId: number): Promise<SimulatedPaymentResponse> => {
  const res = await apiClient<SimulatedPaymentResponse>(`/bookings/${bookingId}/payments/simulate`, { method: 'POST' });
  return res.data as SimulatedPaymentResponse;
};
