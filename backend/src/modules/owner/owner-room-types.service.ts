import { OwnerRoomTypesRepository } from './owner-room-types.repository';
import { OwnerHotelsService } from './owner-hotels.service';
import { AppError } from '../../common/errors/app-error';
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';
import { extractCloudinaryPublicId } from '../../common/utils/cloudinary-url';
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from './owner-room-types.schemas';
import { assertImageCountBelowLimit, MAX_ROOM_TYPE_IMAGES } from '../../common/utils/image-upload';
import { ROOM_TYPE_STATUS } from '../../common/constants/hotel-status';
import { reconcileBookingLifecycle } from '../bookings/booking-lifecycle';

const ROOM_IMAGE_FOLDER = 'hotel-booking/room-types';

export class OwnerRoomTypesService {
  constructor(
    private readonly repository: OwnerRoomTypesRepository = new OwnerRoomTypesRepository(),
    private readonly hotelsService: OwnerHotelsService = new OwnerHotelsService()
  ) {}

  /** Tải loại phòng và kiểm tra quyền sở hữu */
  async getOwnedRoomType(ownerId: number, maLoaiPhong: number) {
    const roomType = await this.repository.findByIdWithHotel(maLoaiPhong);
    if (!roomType) throw AppError.notFound('Không tìm thấy loại phòng');
    if (roomType.KHACH_SAN.MaTaiKhoanSoHuu !== ownerId) {
      throw AppError.forbidden('Bạn không có quyền truy cập loại phòng này');
    }
    return roomType;
  }

  async listForHotel(ownerId: number, maKhachSan: number) {
    await this.hotelsService.getOwnedHotel(ownerId, maKhachSan);
    return this.repository.listForHotel(maKhachSan);
  }

  async create(ownerId: number, maKhachSan: number, input: CreateRoomTypeInput) {
    await this.hotelsService.getOwnedHotel(ownerId, maKhachSan);
    return this.repository.create(maKhachSan, {
      TenLoaiPhong: input.TenLoaiPhong,
      SoGiuong: input.SoGiuong,
      SucChua: input.SucChua,
      DienTich: input.DienTich,
      LoaiGiuong: input.LoaiGiuong,
      MoTa: input.MoTa ?? null,
      TrangThai: this.repository.defaultStatus(),
    });
  }

  async update(ownerId: number, maLoaiPhong: number, input: UpdateRoomTypeInput) {
    await this.getOwnedRoomType(ownerId, maLoaiPhong);
    // Ngừng bán qua cập nhật cũng đi qua đường kiểm tra an toàn
    const { TrangThai, ...profile } = input;
    // Chạy bước ngừng bán trước
    if (TrangThai === ROOM_TYPE_STATUS.DISCONTINUED) await this.deactivate(ownerId, maLoaiPhong);
    if (Object.keys(profile).length > 0) await this.repository.update(maLoaiPhong, profile);
    if (TrangThai === ROOM_TYPE_STATUS.ACTIVE) await this.reactivate(ownerId, maLoaiPhong);
    return this.repository.findByIdWithHotel(maLoaiPhong);
  }

  /** Ngừng bán chỉ khi không còn đơn mở */
  async deactivate(ownerId: number, maLoaiPhong: number) {
    const roomType = await this.getOwnedRoomType(ownerId, maLoaiPhong);
    if (roomType.TrangThai === ROOM_TYPE_STATUS.DISCONTINUED) return roomType;

    await reconcileBookingLifecycle();
    const open = await this.repository.countOpenBookings(maLoaiPhong);
    if (open > 0) throw this.openBookingsError(open);

    const changed = await this.repository.discontinueWhenNoOpenBookings(maLoaiPhong);
    if (!changed) {
      // Mất cạnh tranh nên báo xung đột
      const current = await this.repository.countOpenBookings(maLoaiPhong);
      if (current > 0) throw this.openBookingsError(current);
    }
    return (await this.repository.findByIdWithHotel(maLoaiPhong))!;
  }

  private openBookingsError(count: number): AppError {
    return AppError.conflict(
      `Không thể ngừng bán khi loại phòng còn ${count} đơn đặt phòng chưa hoàn tất (chờ thanh toán hoặc khách chưa trả phòng)`,
      { SoDonChuaHoanTat: count }
    );
  }

  /** Bán lại loại phòng */
  async reactivate(ownerId: number, maLoaiPhong: number) {
    const roomType = await this.getOwnedRoomType(ownerId, maLoaiPhong);
    if (roomType.TrangThai === ROOM_TYPE_STATUS.ACTIVE) return roomType;
    await this.repository.update(maLoaiPhong, { TrangThai: ROOM_TYPE_STATUS.ACTIVE });
    // Trả cùng dạng dữ liệu như khi xem chi tiết
    return (await this.repository.findByIdWithHotel(maLoaiPhong))!;
  }

  async replaceAmenities(ownerId: number, maLoaiPhong: number, amenityIds: number[]) {
    await this.getOwnedRoomType(ownerId, maLoaiPhong);
    const ok = await this.repository.amenitiesExist(amenityIds);
    if (!ok) throw AppError.badRequest('Một hoặc nhiều tiện nghi không tồn tại');
    await this.repository.replaceAmenities(maLoaiPhong, amenityIds);
    return this.repository.findByIdWithHotel(maLoaiPhong);
  }

  async addImage(ownerId: number, maLoaiPhong: number, base64Image: string) {
    await this.getOwnedRoomType(ownerId, maLoaiPhong);
    const imageCount = await this.repository.countImages(maLoaiPhong);
    assertImageCountBelowLimit(imageCount, MAX_ROOM_TYPE_IMAGES);
    const uploaded = await CloudinaryIntegration.uploadImage(base64Image, ROOM_IMAGE_FOLDER);
    const isFirst = imageCount === 0;
    return this.repository.addImage(maLoaiPhong, uploaded.url, isFirst);
  }

  async removeImage(ownerId: number, maLoaiPhong: number, maHinhAnh: number) {
    await this.getOwnedRoomType(ownerId, maLoaiPhong);
    const image = await this.repository.findImage(maLoaiPhong, maHinhAnh);
    if (!image) throw AppError.notFound('Không tìm thấy hình ảnh');

    const publicId = extractCloudinaryPublicId(image.URL);
    if (publicId) {
      await CloudinaryIntegration.deleteImage(publicId).catch(() => undefined);
    }
    await this.repository.deleteImage(maHinhAnh);
  }

  async setPrimaryImage(ownerId: number, maLoaiPhong: number, maHinhAnh: number) {
    await this.getOwnedRoomType(ownerId, maLoaiPhong);
    const image = await this.repository.findImage(maLoaiPhong, maHinhAnh);
    if (!image) throw AppError.notFound('Không tìm thấy hình ảnh');
    await this.repository.setPrimaryImage(maLoaiPhong, maHinhAnh);
    return this.repository.findByIdWithHotel(maLoaiPhong);
  }
}
