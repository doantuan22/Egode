import { apiClient } from '../../services/apiClient';
import type { PaginatedApiResponse } from '../../types/api';
import type {
  HotelSearchItem,
  HotelDetail,
  RoomTypeWithAvailability,
  HotelSearchParams,
  RoomsQueryParams,
} from './types';

const buildSearchQuery = (params: HotelSearchParams): string => {
  const q = new URLSearchParams();
  if (params.location) q.set('location', params.location);
  if (params.keyword) q.set('keyword', params.keyword);
  q.set('checkIn', params.checkIn);
  q.set('checkOut', params.checkOut);
  q.set('guests', String(params.guests));
  if (params.minPrice !== undefined) q.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) q.set('maxPrice', String(params.maxPrice));
  if (params.starRating !== undefined) q.set('starRating', String(params.starRating));
  if (params.amenities && params.amenities.length > 0) q.set('amenities', params.amenities.join(','));
  q.set('page', String(params.page));
  q.set('limit', String(params.limit));
  q.set('sort', params.sort);
  return q.toString();
};

export const searchHotels = async (
  params: HotelSearchParams
): Promise<{ items: HotelSearchItem[]; pagination: PaginatedApiResponse<HotelSearchItem>['pagination'] }> => {
  const res = await apiClient<HotelSearchItem[], PaginatedApiResponse<HotelSearchItem>>(
    `/hotels?${buildSearchQuery(params)}`
  );
  return { items: res.data ?? [], pagination: res.pagination };
};

export const getHotelDetail = async (id: number): Promise<HotelDetail> => {
  const res = await apiClient<HotelDetail>(`/hotels/${id}`);
  return res.data as HotelDetail;
};

export const getHotelRooms = async (
  id: number,
  params: RoomsQueryParams
): Promise<RoomTypeWithAvailability[]> => {
  const q = new URLSearchParams({ checkIn: params.checkIn, checkOut: params.checkOut });
  if (params.guests) q.set('guests', String(params.guests));
  const res = await apiClient<RoomTypeWithAvailability[]>(`/hotels/${id}/rooms?${q.toString()}`);
  return res.data ?? [];
};
