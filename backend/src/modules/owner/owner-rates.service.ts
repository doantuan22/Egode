import { OwnerRatesRepository } from './owner-rates.repository';
import { OwnerRoomTypesService } from './owner-room-types.service';
import { AppError } from '../../common/errors/app-error';
import { HOTEL_STATUS } from '../../common/constants/hotel-status';
import { businessToday } from '../../common/utils/stay-dates';
import { toDateKey } from '../hotels/availability';
import type { ListRatesQuery, BulkUpsertRatesInput } from './owner-rates.schemas';

export class OwnerRatesService {
  constructor(
    private readonly repository: OwnerRatesRepository = new OwnerRatesRepository(),
    private readonly roomTypesService: OwnerRoomTypesService = new OwnerRoomTypesService()
  ) {}

  async list(ownerId: number, maLoaiPhong: number, query: ListRatesQuery) {
    await this.roomTypesService.getOwnedRoomType(ownerId, maLoaiPhong);
    return this.repository.listForRoomType(maLoaiPhong, query.from, query.to);
  }

  /**
   * Prices and room counts can only be set for today and later (Asia/Ho_Chi_Minh), never for a suspended
   * hotel, and never below what is already booked for a night (enforced under lock in the repository).
   */
  async bulkUpsert(ownerId: number, maLoaiPhong: number, input: BulkUpsertRatesInput) {
    const roomType = await this.roomTypesService.getOwnedRoomType(ownerId, maLoaiPhong);
    if (roomType.KHACH_SAN.TrangThai === HOTEL_STATUS.SUSPENDED) {
      throw AppError.forbidden('Khách sạn đang bị đình chỉ: không thể thay đổi giá hoặc số phòng');
    }

    const today = businessToday();
    const past = input.rates.map((r) => toDateKey(r.NgayApDung)).filter((key) => key < today).sort();
    if (past.length > 0) {
      throw AppError.badRequest(
        `Không thể sửa giá hoặc số phòng của ngày đã qua (${past[0]}${past.length > 1 ? ` và ${past.length - 1} ngày khác` : ''})`,
        past.map((key) => ({ field: `NgayApDung:${key}`, message: 'Ngày đã qua, không thể chỉnh sửa' }))
      );
    }

    return this.repository.bulkUpsertGuarded(maLoaiPhong, input.rates);
  }
}
