import { useQuery } from '@tanstack/react-query';
import { createQuote } from './api';
import type { QuoteRequest } from './types';

/** Báo giá và tình trạng phòng cho kỳ lưu trú */
export function useQuote(hotelId: number, request: QuoteRequest | null) {
  return useQuery({
    queryKey: ['quotes', hotelId, request],
    queryFn: () => createQuote(hotelId, request as QuoteRequest),
    enabled: request !== null && hotelId > 0,
    retry: false,
    staleTime: 0,
    gcTime: 60_000,
  });
}
