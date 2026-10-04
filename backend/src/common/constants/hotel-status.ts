/**
 * KHACH_SAN.TrangThai — open domain (Chương 6.5: "Chờ duyệt, Hoạt động, Đình chỉ,...").
 * Only ACTIVE hotels are ever shown through the public discovery APIs (M2 §4).
 */
export const HOTEL_STATUS = {
  PENDING_APPROVAL: 'Chờ duyệt',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  REJECTED: 'Từ chối',
  SUSPENDED: 'Đình chỉ',
} as const;

export type HotelStatus = (typeof HOTEL_STATUS)[keyof typeof HOTEL_STATUS];

/**
 * LOAI_PHONG.TrangThai — open domain (Chương 6.9: "Hoạt động, Ngừng bán,...").
 * Only ACTIVE room types are shown through the public discovery APIs.
 */
export const ROOM_TYPE_STATUS = {
  ACTIVE: 'Hoạt động',
  DISCONTINUED: 'Ngừng bán',
} as const;

export type RoomTypeStatus = (typeof ROOM_TYPE_STATUS)[keyof typeof ROOM_TYPE_STATUS];

/**
 * QUY_PHONG_GIA.TrangThai — open domain (Chương 6.12: "Mở bán, Đóng bán,...").
 * Only OPEN_FOR_SALE rows contribute inventory/price to search & availability.
 */
export const ROOM_RATE_STATUS = {
  OPEN_FOR_SALE: 'Mở bán',
  CLOSED: 'Đóng bán',
} as const;

export type RoomRateStatus = (typeof ROOM_RATE_STATUS)[keyof typeof ROOM_RATE_STATUS];

/**
 * DAT_PHONG.TrangThai — open domain (Chương 6.16: "Chờ thanh toán, Đã xác nhận,
 * Đã hủy, Hoàn tất,..."). Every status EXCEPT CANCELLED occupies inventory —
 * M2 business rule: "Không được overcount booking đã hủy" implies everything
 * else (pending payment, confirmed, completed) still holds the room.
 */
export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Hoàn tất',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
