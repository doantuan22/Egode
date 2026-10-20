import { OwnerHotelsRepository } from './owner-hotels.repository';
import { AppError } from '../../common/errors/app-error';
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';
import { extractCloudinaryPublicId } from '../../common/utils/cloudinary-url';
import type { CreateHotelInput, UpdateHotelInput } from './owner-hotels.schemas';
import type { KHACH_SAN } from '../../generated/prisma/client';
import { assertImageCountBelowLimit, MAX_HOTEL_IMAGES } from '../../common/utils/image-upload';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';

const HOTEL_IMAGE_FOLDER = 'hotel-booking/hotels';

/** Các trường hồ sơ được sửa khi khách sạn bị đình chỉ */
const SUSPENDED_EDITABLE_FIELDS = ['TenKhachSan', 'DiaChiChiTiet', 'MoTa'] as const;

export class OwnerHotelsService {
  constructor(private readonly repository: OwnerHotelsRepository = new OwnerHotelsRepository()) {}

  /** Tải khách sạn và kiểm tra quyền sở hữu */
  async getOwnedHotel(ownerId: number, maKhachSan: number): Promise<KHACH_SAN> {
    const hotel = await this.repository.findById(maKhachSan);
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');
    if (hotel.MaTaiKhoanSoHuu !== ownerId) {
      throw AppError.forbidden('Bạn không có quyền truy cập khách sạn này');
    }
    return hotel;
  }

  async listMine(ownerId: number) {
    return this.repository.listByOwner(ownerId);
  }

  async create(ownerId: number, input: CreateHotelInput) {
    const diaPhuongOk = await this.repository.diaPhuongExists(input.MaDiaPhuong);
    if (!diaPhuongOk) throw AppError.badRequest('Địa phương không tồn tại');

    const now = new Date();
    return this.repository.create(ownerId, {
      TenKhachSan: input.TenKhachSan,
      DiaChiChiTiet: input.DiaChiChiTiet,
      HangSao: input.HangSao,
      MoTa: input.MoTa ?? null,
      GioNhanPhong: input.GioNhanPhong,
      GioTraPhong: input.GioTraPhong,
      MaDiaPhuong: input.MaDiaPhuong,
      // Khách sạn mới luôn chờ admin duyệt
      TrangThai: this.repository.hotelStatusDefault(),
      NgayDangKy: now,
      NgayCapNhat: now,
    });
  }

  async update(ownerId: number, maKhachSan: number, input: UpdateHotelInput) {
    const hotel = await this.getOwnedHotel(ownerId, maKhachSan);

    // Khách sạn bị đình chỉ chỉ được sửa nội dung hồ sơ
    if (hotel.TrangThai === HOTEL_STATUS.SUSPENDED) {
      const forbidden = Object.keys(input).filter((key) => !SUSPENDED_EDITABLE_FIELDS.includes(key as (typeof SUSPENDED_EDITABLE_FIELDS)[number]));
      if (forbidden.length > 0) {
        throw AppError.forbidden(`Khách sạn đang bị đình chỉ: chỉ được sửa tên, địa chỉ và mô tả (không được sửa: ${forbidden.join(', ')})`);
      }
    }

    if (input.MaDiaPhuong !== undefined) {
      const ok = await this.repository.diaPhuongExists(input.MaDiaPhuong);
      if (!ok) throw AppError.badRequest('Địa phương không tồn tại');
    }

    return this.repository.update(maKhachSan, { ...input, NgayCapNhat: new Date() });
  }

  /** Ngừng hoạt động chỉ khi không còn đơn mở */
  async deactivate(ownerId: number, maKhachSan: number) {
    const hotel = await this.getOwnedHotel(ownerId, maKhachSan);
    if (hotel.TrangThai === HOTEL_STATUS.INACTIVE) return hotel;
    this.assertNotSuspended(hotel.TrangThai);
    if (hotel.TrangThai !== HOTEL_STATUS.ACTIVE) {
      throw AppError.badRequest('Chỉ có thể ngừng hoạt động khách sạn đang hoạt động');
    }

    await reconcileBookingLifecycle();
    const openBookings = await this.repository.countOpenBookings(maKhachSan);
    if (openBookings > 0) throw this.openBookingsError(openBookings);

    const changed = await this.repository.deactivateWhenNoOpenBookings(maKhachSan, new Date());
    if (!changed) {
      // Mất cạnh tranh nên báo xung đột
      const current = await this.repository.countOpenBookings(maKhachSan);
      if (current > 0) throw this.openBookingsError(current);
      throw AppError.conflict('Khách sạn đã đổi trạng thái trước đó — vui lòng tải lại');
    }
    return (await this.repository.findById(maKhachSan))!;
  }

  private openBookingsError(count: number): AppError {
    return AppError.conflict(
      `Không thể ngừng hoạt động khi khách sạn còn ${count} đơn đặt phòng chưa hoàn tất (chờ thanh toán hoặc khách chưa trả phòng)`,
      { SoDonChuaHoanTat: count }
    );
  }

  /** Chỉ bật lại khách sạn đã được admin duyệt */
  async reactivate(ownerId: number, maKhachSan: number) {
    const hotel = await this.getOwnedHotel(ownerId, maKhachSan);
    if (hotel.TrangThai === HOTEL_STATUS.ACTIVE) return hotel;
    this.assertNotSuspended(hotel.TrangThai);
    if (hotel.TrangThai !== HOTEL_STATUS.INACTIVE || !hotel.NgayDuyet) {
      throw AppError.badRequest('Chỉ có thể bật lại khách sạn đã được quản trị viên duyệt và đang ngừng hoạt động');
    }
    return this.transition(maKhachSan, HOTEL_STATUS.INACTIVE, HOTEL_STATUS.ACTIVE, 'Khách sạn đã đổi trạng thái trước đó — vui lòng tải lại');
  }

  private assertNotSuspended(trangThai: string): void {
    if (trangThai === HOTEL_STATUS.SUSPENDED) throw AppError.badRequest('Khách sạn đang bị đình chỉ bởi quản trị viên');
  }

  /** Cập nhật có điều kiện để tránh ghi đè thao tác của admin */
  private async transition(maKhachSan: number, from: string, to: string, conflictMessage: string) {
    const changed = await this.repository.changeStatus(maKhachSan, from, to, new Date());
    if (!changed) throw AppError.conflict(conflictMessage);
    return (await this.repository.findById(maKhachSan))!;
  }

  async replaceAmenities(ownerId: number, maKhachSan: number, amenityIds: number[]) {
    await this.getOwnedHotel(ownerId, maKhachSan);
    const ok = await this.repository.amenitiesExist(amenityIds);
    if (!ok) throw AppError.badRequest('Một hoặc nhiều tiện nghi không tồn tại');
    await this.repository.replaceAmenities(maKhachSan, amenityIds);
    return this.repository.findById(maKhachSan);
  }

  async addImage(ownerId: number, maKhachSan: number, base64Image: string) {
    await this.getOwnedHotel(ownerId, maKhachSan);
    const imageCount = await this.repository.countImages(maKhachSan);
    assertImageCountBelowLimit(imageCount, MAX_HOTEL_IMAGES);
    const uploaded = await CloudinaryIntegration.uploadImage(base64Image, HOTEL_IMAGE_FOLDER);
    const isFirst = imageCount === 0;
    return this.repository.addImage(maKhachSan, uploaded.url, isFirst);
  }

  async removeImage(ownerId: number, maKhachSan: number, maHinhAnh: number) {
    await this.getOwnedHotel(ownerId, maKhachSan);
    const image = await this.repository.findImage(maKhachSan, maHinhAnh);
    if (!image) throw AppError.notFound('Không tìm thấy hình ảnh');

    const publicId = extractCloudinaryPublicId(image.URL);
    if (publicId) {
      await CloudinaryIntegration.deleteImage(publicId).catch(() => undefined);
    }
    await this.repository.deleteImage(maHinhAnh);
  }

  async setPrimaryImage(ownerId: number, maKhachSan: number, maHinhAnh: number) {
    await this.getOwnedHotel(ownerId, maKhachSan);
    const image = await this.repository.findImage(maKhachSan, maHinhAnh);
    if (!image) throw AppError.notFound('Không tìm thấy hình ảnh');
    await this.repository.setPrimaryImage(maKhachSan, maHinhAnh);
    return this.repository.findById(maKhachSan);
  }
}
