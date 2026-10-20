/** Trạng thái khách sạn */
export const HOTEL_STATUS = {
  PENDING_APPROVAL: 'Chờ duyệt',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  REJECTED: 'Từ chối',
  SUSPENDED: 'Đình chỉ',
} as const;

export type HotelStatus = (typeof HOTEL_STATUS)[keyof typeof HOTEL_STATUS];

/** Trạng thái loại phòng */
export const ROOM_TYPE_STATUS = {
  ACTIVE: 'Hoạt động',
  DISCONTINUED: 'Ngừng bán',
} as const;

export type RoomTypeStatus = (typeof ROOM_TYPE_STATUS)[keyof typeof ROOM_TYPE_STATUS];

/** Trạng thái quỹ phòng và giá */
export const ROOM_RATE_STATUS = {
  OPEN_FOR_SALE: 'Mở bán',
  CLOSED: 'Đóng bán',
} as const;

export type RoomRateStatus = (typeof ROOM_RATE_STATUS)[keyof typeof ROOM_RATE_STATUS];

/** Trạng thái đặt phòng */
export const BOOKING_STATUS = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  COMPLETED: 'Hoàn tất',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
