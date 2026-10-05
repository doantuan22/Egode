import { OwnerHotelsRepository } from './owner-hotels.repository';
import { AppError } from '../../common/errors/app-error';
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';
import { extractCloudinaryPublicId } from '../../common/utils/cloudinary-url';
import type { CreateHotelInput, UpdateHotelInput } from './owner-hotels.schemas';
import type { KHACH_SAN } from '../../generated/prisma/client';
import { assertImageCountBelowLimit, MAX_HOTEL_IMAGES } from '../../common/utils/image-upload';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';

const HOTEL_IMAGE_FOLDER = 'hotel-booking/hotels';

/** The profile fields an owner may still correct while the hotel is suspended by an administrator. */
const SUSPENDED_EDITABLE_FIELDS = ['TenKhachSan', 'DiaChiChiTiet', 'MoTa'] as const;

export class OwnerHotelsService {
  constructor(private readonly repository: OwnerHotelsRepository = new OwnerHotelsRepository()) {}

  /** Loads a hotel and asserts it belongs to ownerId — 404 if it doesn't exist, 403 if someone else's. */
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
      // Never owner-approved — an admin approval workflow is a later phase
      // (same documented gap as "no partner-approval endpoint" from M1).
      TrangThai: this.repository.hotelStatusDefault(),
      NgayDangKy: now,
      NgayCapNhat: now,
    });
  }

  async update(ownerId: number, maKhachSan: number, input: UpdateHotelInput) {
    const hotel = await this.getOwnedHotel(ownerId, maKhachSan);

    // A suspended hotel may be corrected (to fix the violation) but not reconfigured: only the profile text can change.
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

  /** Hoạt động → Ngừng hoạt động. Only a hotel that is live can be switched off by its owner. */
  async deactivate(ownerId: number, maKhachSan: number) {
    const hotel = await this.getOwnedHotel(ownerId, maKhachSan);
    if (hotel.TrangThai === HOTEL_STATUS.INACTIVE) return hotel;
    this.assertNotSuspended(hotel.TrangThai);
    if (hotel.TrangThai !== HOTEL_STATUS.ACTIVE) {
      throw AppError.badRequest('Chỉ có thể ngừng hoạt động khách sạn đang hoạt động');
    }
    return this.transition(maKhachSan, HOTEL_STATUS.ACTIVE, HOTEL_STATUS.INACTIVE, 'Chỉ có thể ngừng hoạt động khách sạn đang hoạt động');
  }

  /**
   * Ngừng hoạt động → Hoạt động. Only for a hotel an admin has already approved (NgayDuyet is written by
   * the admin approval and by nothing else), so an owner can never use this to skip the approval queue.
   */
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

  /** Guarded UPDATE (`WHERE TrangThai = from`): a concurrent admin action turns this into a conflict instead of being overwritten. */
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
