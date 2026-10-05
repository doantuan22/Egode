import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createVnpayPayment, getPaymentStatus, paySimulated, retryRefund } from './api';

export function useCreateVnpayPayment(bookingId: number) {
  return useMutation({
    mutationFn: () => createVnpayPayment(bookingId),
  });
}

export function usePaymentStatus(bookingId: number, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ['payment-status', bookingId],
    queryFn: () => getPaymentStatus(bookingId),
    enabled: (options.enabled ?? true) && Number.isFinite(bookingId) && bookingId > 0,
    refetchInterval: options.refetchInterval,
  });
}

export function useRetryRefund(bookingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refundId: number) => retryRefund(refundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] });
    },
  });
}

export function useSimulatedPayment(bookingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => paySimulated(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
