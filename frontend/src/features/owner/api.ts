import { apiClient } from '../../services/apiClient';
import type {
  OwnerHotel,
  OwnerRoomType,
  RateRow,
  HotelFormValues,
  RoomTypeFormValues,
  RateItemInput,
  OwnerBooking,
  OwnerBookingsFilters,
} from './types';

// ---- Hotels ----

export const listMyHotels = async (): Promise<OwnerHotel[]> => {
  const res = await apiClient<OwnerHotel[]>('/owner/hotels');
  return res.data ?? [];
};

export const getMyHotel = async (id: number): Promise<OwnerHotel> => {
  const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}`);
  return res.data as OwnerHotel;
};

export const createHotel = async (payload: HotelFormValues): Promise<OwnerHotel> => {
  const res = await apiClient<OwnerHotel>('/owner/hotels', { method: 'POST', body: JSON.stringify(payload) });
  return res.data as OwnerHotel;
};

export const updateHotel = async (id: number, payload: Partial<HotelFormValues>): Promise<OwnerHotel> => {
  const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  return res.data as OwnerHotel;
};
export const deactivateHotel = async (id: number): Promise<OwnerHotel> => { const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}/deactivate`, { method: 'POST' }); return res.data as OwnerHotel; };

export const reactivateHotel = async (id: number): Promise<OwnerHotel> => { const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}/reactivate`, { method: 'POST' }); return res.data as OwnerHotel; };

export const replaceHotelAmenities = async (id: number, amenityIds: number[]): Promise<OwnerHotel> => {
  const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}/amenities`, {
    method: 'PUT',
    body: JSON.stringify({ amenityIds }),
  });
  return res.data as OwnerHotel;
};

export const uploadHotelImage = async (id: number, imageDataUrl: string) => {
  const res = await apiClient(`/owner/hotels/${id}/images`, {
    method: 'POST',
    body: JSON.stringify({ image: imageDataUrl }),
  });
  return res.data;
};

export const deleteHotelImage = async (id: number, imageId: number): Promise<void> => {
  await apiClient(`/owner/hotels/${id}/images/${imageId}`, { method: 'DELETE' });
};

export const setPrimaryHotelImage = async (id: number, imageId: number): Promise<OwnerHotel> => {
  const res = await apiClient<OwnerHotel>(`/owner/hotels/${id}/images/${imageId}`, { method: 'PATCH' });
  return res.data as OwnerHotel;
};

// ---- Room types ----

export const listRoomTypes = async (hotelId: number): Promise<OwnerRoomType[]> => {
  const res = await apiClient<OwnerRoomType[]>(`/owner/hotels/${hotelId}/room-types`);
  return res.data ?? [];
};

export const getRoomType = async (id: number): Promise<OwnerRoomType> => {
  const res = await apiClient<OwnerRoomType>(`/owner/room-types/${id}`);
  return res.data as OwnerRoomType;
};

export const createRoomType = async (hotelId: number, payload: RoomTypeFormValues): Promise<OwnerRoomType> => {
  const res = await apiClient<OwnerRoomType>(`/owner/hotels/${hotelId}/room-types`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data as OwnerRoomType;
};

export const updateRoomType = async (
  id: number,
  payload: Partial<RoomTypeFormValues>
): Promise<OwnerRoomType> => {
  const res = await apiClient<OwnerRoomType>(`/owner/room-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data as OwnerRoomType;
};
export const deactivateRoomType = async (id: number): Promise<OwnerRoomType> => { const res = await apiClient<OwnerRoomType>(`/owner/room-types/${id}/deactivate`, { method: 'POST' }); return res.data as OwnerRoomType; };

export const listOwnerBookings = async (hotelId: number, filters: OwnerBookingsFilters) => { const query = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, String(value)); }); const res = await apiClient<OwnerBooking[]>(`/owner/hotels/${hotelId}/bookings?${query.toString()}`); const paginated = res as typeof res & { pagination: { page: number; limit: number; total: number; totalPages: number } }; return { items: res.data ?? [], pagination: paginated.pagination }; };
export const getOwnerBooking = async (hotelId: number, bookingId: number): Promise<OwnerBooking> => { const res = await apiClient<OwnerBooking>(`/owner/hotels/${hotelId}/bookings/${bookingId}`); return res.data as OwnerBooking; };

export const replaceRoomTypeAmenities = async (id: number, amenityIds: number[]): Promise<OwnerRoomType> => {
  const res = await apiClient<OwnerRoomType>(`/owner/room-types/${id}/amenities`, {
    method: 'PUT',
    body: JSON.stringify({ amenityIds }),
  });
  return res.data as OwnerRoomType;
};

export const uploadRoomTypeImage = async (id: number, imageDataUrl: string) => {
  const res = await apiClient(`/owner/room-types/${id}/images`, {
    method: 'POST',
    body: JSON.stringify({ image: imageDataUrl }),
  });
  return res.data;
};

export const deleteRoomTypeImage = async (id: number, imageId: number): Promise<void> => {
  await apiClient(`/owner/room-types/${id}/images/${imageId}`, { method: 'DELETE' });
};

export const setPrimaryRoomTypeImage = async (id: number, imageId: number): Promise<OwnerRoomType> => {
  const res = await apiClient<OwnerRoomType>(`/owner/room-types/${id}/images/${imageId}`, { method: 'PATCH' });
  return res.data as OwnerRoomType;
};

// ---- Rates (inventory/pricing) ----

export const listRates = async (roomTypeId: number, from: string, to: string): Promise<RateRow[]> => {
  const q = new URLSearchParams({ from, to });
  const res = await apiClient<RateRow[]>(`/owner/room-types/${roomTypeId}/rates?${q.toString()}`);
  return res.data ?? [];
};

export const bulkUpsertRates = async (roomTypeId: number, rates: RateItemInput[]): Promise<RateRow[]> => {
  const res = await apiClient<RateRow[]>(`/owner/room-types/${roomTypeId}/rates`, {
    method: 'PUT',
    body: JSON.stringify({ rates }),
  });
  return res.data ?? [];
};
