import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ownerApi from './api';
import type { HotelFormValues, RoomTypeFormValues, RateItemInput, OwnerBookingsFilters } from './types';

const hotelsKey = ['owner', 'hotels'] as const;
const hotelKey = (id: number) => ['owner', 'hotels', id] as const;
const roomTypesKey = (hotelId: number) => ['owner', 'hotels', hotelId, 'room-types'] as const;
const roomTypeKey = (id: number) => ['owner', 'room-types', id] as const;
const ratesKey = (id: number, from: string, to: string) => ['owner', 'room-types', id, 'rates', from, to] as const;

export function useMyHotels() {
  return useQuery({ queryKey: hotelsKey, queryFn: ownerApi.listMyHotels });
}

export function useMyHotel(id: number) {
  return useQuery({ queryKey: hotelKey(id), queryFn: () => ownerApi.getMyHotel(id), enabled: id > 0 });
}

export function useCreateHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: HotelFormValues) => ownerApi.createHotel(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelsKey }),
  });
}

export function useUpdateHotel(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<HotelFormValues>) => ownerApi.updateHotel(id, payload),
    onSuccess: (hotel) => {
      queryClient.setQueryData(hotelKey(id), hotel);
      queryClient.invalidateQueries({ queryKey: hotelsKey });
    },
  });
}
export function useDeactivateHotel(id: number) { const queryClient = useQueryClient(); return useMutation({ mutationFn: () => ownerApi.deactivateHotel(id), onSuccess: (hotel) => { queryClient.setQueryData(hotelKey(id), hotel); queryClient.invalidateQueries({ queryKey: hotelsKey }); } }); }

export function useReactivateHotel(id: number) { const queryClient = useQueryClient(); return useMutation({ mutationFn: () => ownerApi.reactivateHotel(id), onSuccess: (hotel) => { queryClient.setQueryData(hotelKey(id), hotel); queryClient.invalidateQueries({ queryKey: hotelsKey }); } }); }

export function useReplaceHotelAmenities(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amenityIds: number[]) => ownerApi.replaceHotelAmenities(id, amenityIds),
    onSuccess: (hotel) => queryClient.setQueryData(hotelKey(id), hotel),
  });
}

export function useUploadHotelImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageDataUrl: string) => ownerApi.uploadHotelImage(id, imageDataUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKey(id) }),
  });
}

export function useDeleteHotelImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: number) => ownerApi.deleteHotelImage(id, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKey(id) }),
  });
}

export function useSetPrimaryHotelImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: number) => ownerApi.setPrimaryHotelImage(id, imageId),
    onSuccess: (hotel) => queryClient.setQueryData(hotelKey(id), hotel),
  });
}

export function useRoomTypes(hotelId: number) {
  return useQuery({ queryKey: roomTypesKey(hotelId), queryFn: () => ownerApi.listRoomTypes(hotelId), enabled: hotelId > 0 });
}

export function useRoomType(id: number) {
  return useQuery({ queryKey: roomTypeKey(id), queryFn: () => ownerApi.getRoomType(id), enabled: id > 0 });
}

export function useCreateRoomType(hotelId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoomTypeFormValues) => ownerApi.createRoomType(hotelId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypesKey(hotelId) }),
  });
}

export function useUpdateRoomType(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<RoomTypeFormValues>) => ownerApi.updateRoomType(id, payload),
    onSuccess: (roomType) => {
      queryClient.setQueryData(roomTypeKey(id), roomType);
      queryClient.invalidateQueries({ queryKey: roomTypesKey(roomType.MaKhachSan) });
    },
  });
}
export function useDeactivateRoomType(id: number) { const queryClient = useQueryClient(); return useMutation({ mutationFn: () => ownerApi.deactivateRoomType(id), onSuccess: (roomType) => { queryClient.setQueryData(roomTypeKey(id), roomType); queryClient.invalidateQueries({ queryKey: roomTypesKey(roomType.MaKhachSan) }); } }); }

export function useOwnerBookings(hotelId: number, filters: OwnerBookingsFilters) { return useQuery({ queryKey: ['owner', 'hotels', hotelId, 'bookings', filters], queryFn: () => ownerApi.listOwnerBookings(hotelId, filters), enabled: hotelId > 0 }); }
export function useOwnerBooking(hotelId: number, bookingId: number) { return useQuery({ queryKey: ['owner', 'hotels', hotelId, 'bookings', bookingId], queryFn: () => ownerApi.getOwnerBooking(hotelId, bookingId), enabled: hotelId > 0 && bookingId > 0 }); }

export function useReplaceRoomTypeAmenities(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amenityIds: number[]) => ownerApi.replaceRoomTypeAmenities(id, amenityIds),
    onSuccess: (roomType) => queryClient.setQueryData(roomTypeKey(id), roomType),
  });
}

export function useUploadRoomTypeImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageDataUrl: string) => ownerApi.uploadRoomTypeImage(id, imageDataUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypeKey(id) }),
  });
}

export function useDeleteRoomTypeImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: number) => ownerApi.deleteRoomTypeImage(id, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypeKey(id) }),
  });
}

export function useSetPrimaryRoomTypeImage(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: number) => ownerApi.setPrimaryRoomTypeImage(id, imageId),
    onSuccess: (roomType) => queryClient.setQueryData(roomTypeKey(id), roomType),
  });
}

export function useRates(roomTypeId: number, from: string, to: string) {
  return useQuery({
    queryKey: ratesKey(roomTypeId, from, to),
    queryFn: () => ownerApi.listRates(roomTypeId, from, to),
    enabled: roomTypeId > 0 && !!from && !!to,
  });
}

export function useBulkUpsertRates(roomTypeId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rates: RateItemInput[]) => ownerApi.bulkUpsertRates(roomTypeId, rates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner', 'room-types', roomTypeId, 'rates'] }),
  });
}
