import { z } from 'zod';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODES } from '../../common/errors/error-codes';

/** Quy tắc sức chứa: tổng sức chứa các phòng phải đủ số khách */
export const MAX_GUESTS = 50;

/** Số khách trong yêu cầu, mặc định một khách */
export const guestsInputSchema = z.coerce.number().int('Số khách phải là số nguyên').min(1, 'Số khách phải từ 1 trở lên').max(MAX_GUESTS, `Tối đa ${MAX_GUESTS} khách`).default(1);

export interface CapacityLine {
  sucChua: number;
  soLuong: number;
}

export const totalCapacity = (lines: readonly CapacityLine[]): number => lines.reduce((sum, line) => sum + line.sucChua * line.soLuong, 0);

/** Báo lỗi CAPACITY_EXCEEDED khi phòng không đủ chứa */
export const assertCapacity = (guests: number, lines: readonly CapacityLine[]): number => {
  const capacity = totalCapacity(lines);
  if (capacity < guests) {
    const message = `Các phòng đã chọn chỉ chứa tối đa ${capacity} khách, không đủ cho ${guests} khách. Vui lòng chọn thêm phòng hoặc loại phòng lớn hơn`;
    throw AppError.badRequest(message, [{ field: 'guests', message }], ERROR_CODES.CAPACITY_EXCEEDED);
  }
  return capacity;
};
