import { ReviewsRepository } from './reviews.repository';
import { CloudinaryIntegration, type UploadImageResult } from '../../integrations/cloudinary.integration';
import { validateReviewImages } from './review-images';
import { completeFinishedBookings } from '../bookings/booking-completion';
import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../common/errors/app-error';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';
import { REVIEW_STATUS } from '../../common/constants/review';
import type { ApiPaginationMeta } from '../../common/types/api-response';
import type { CreateReviewInput, AdminListReviewsQuery, PublicReviewsQuery } from './reviews.schemas';
import { maskReviewerName } from './reviewer-name';

const REVIEW_IMAGE_FOLDER = 'hotel-booking/reviews';

/** Đơn đã được đánh giá do hai yêu cầu cùng lúc */
const isDuplicateReviewError = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === 'P2002' || (err.code === 'P2014' && err.meta?.relation === 'DANH_GIAToDAT_PHONG'));

export class ReviewsService {
  constructor(private readonly repository: ReviewsRepository = new ReviewsRepository()) {}

  /** Kiểm tra quyền sở hữu và điều kiện đánh giá */
  private async assertOwnedCompletedBooking(maDatPhong: number, customerId: number) {
    await completeFinishedBookings(getPrismaClient());
    const booking = await this.repository.findBookingForReview(maDatPhong);
    if (!booking) throw AppError.notFound('Không tìm thấy đặt phòng');
    if (booking.MaTaiKhoanKhachHang !== customerId) {
      throw AppError.forbidden('Bạn không có quyền thao tác trên đặt phòng này');
    }
    return booking;
  }

  async createReview(maDatPhong: number, customerId: number, input: CreateReviewInput) {
    const booking = await this.assertOwnedCompletedBooking(maDatPhong, customerId);
    if (booking.TrangThai !== BOOKING_STATUS.COMPLETED) {
      throw AppError.badRequest('Chỉ có thể đánh giá sau khi đặt phòng đã hoàn tất thời gian lưu trú');
    }

    const existing = await this.repository.findByBookingId(maDatPhong);
    if (existing) throw AppError.conflict('Đặt phòng này đã được đánh giá');

    validateReviewImages(input.hinhAnh);

    // Theo dõi ảnh đã tải lên để xóa nếu lỗi
    const uploadedImages: UploadImageResult[] = [];
    try {
      for (const dataUri of input.hinhAnh ?? []) {
        // Ghi nhận ngay sau mỗi lần tải thành công
        uploadedImages.push(await CloudinaryIntegration.uploadImage(dataUri, REVIEW_IMAGE_FOLDER));
      }

      return await this.repository.create(
        {
          maDatPhong,
          maKhachHang: customerId,
          maKhachSan: booking.MaKhachSan,
          diemDanhGia: input.diemDanhGia,
          noiDung: input.noiDung ?? null,
          // Đánh giá hiển thị ngay khi đăng
          trangThai: REVIEW_STATUS.VISIBLE,
        },
        uploadedImages.map((image) => image.url)
      );
    } catch (err) {
      await this.deleteUploadedImages(uploadedImages);
      // Chặn gửi trùng cùng lúc
      if (isDuplicateReviewError(err)) {
        throw AppError.conflict('Đặt phòng này đã được đánh giá');
      }
      throw err;
    }
  }

  /** Xóa ảnh đã tải lên khi lỗi, không ném lỗi */
  private async deleteUploadedImages(images: UploadImageResult[]): Promise<void> {
    if (images.length === 0) return;
    const results = await Promise.allSettled(images.map((image) => CloudinaryIntegration.deleteImage(image.publicId)));
    results.forEach((result, index) => {
      const publicId = images[index].publicId;
      if (result.status === 'rejected') {
        const errorType = result.reason instanceof Error ? result.reason.name : 'UnknownError';
        console.error('Review image cleanup failed', { publicId, errorType });
      } else if (!result.value) {
        console.error('Review image cleanup failed', { publicId, reason: 'Cloudinary did not confirm deletion' });
      }
    });
  }

  /** Trả null khi khách chưa đánh giá đơn này */
  async getMyReview(maDatPhong: number, customerId: number) {
    await this.assertOwnedCompletedBooking(maDatPhong, customerId);
    return this.repository.findByBookingId(maDatPhong);
  }

  async adminList(query: AdminListReviewsQuery) {
    const { items, total } = await this.repository.listAdmin(query);
    const pagination: ApiPaginationMeta = {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
    return { items, pagination };
  }

  async adminGetById(maDanhGia: number) {
    const review = await this.repository.findByIdAdmin(maDanhGia);
    if (!review) throw AppError.notFound('Không tìm thấy đánh giá');
    return review;
  }

  /** Đánh giá hiển thị của khách sạn công khai, mới nhất trước */
  async listPublicForHotel(maKhachSan: number, query: PublicReviewsQuery) {
    if (!(await this.repository.isPublicHotel(maKhachSan))) throw AppError.notFound('Không tìm thấy khách sạn');
    const { items, total } = await this.repository.listPublicByHotel(maKhachSan, query.page, query.limit);
    const summary = (await this.repository.ratingSummaries([maKhachSan])).get(maKhachSan) ?? { DiemTrungBinh: null, SoLuongDanhGia: 0 };
    return {
      items: items.map((review) => ({
        MaDanhGia: review.MaDanhGia,
        DiemDanhGia: review.DiemDanhGia,
        NoiDung: review.NoiDung,
        TenNguoiDanhGia: maskReviewerName(review.TAI_KHOAN.HoTen),
        HinhAnh: review.HINH_ANH_DANH_GIA.map((image) => image.URL),
      })),
      summary,
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } satisfies ApiPaginationMeta,
    };
  }

  /** Khách không thể đổi trạng thái đánh giá */
  async moderate(maDanhGia: number, trangThai: string) {
    const review = await this.repository.findByIdAdmin(maDanhGia);
    if (!review) throw AppError.notFound('Không tìm thấy đánh giá');
    return this.repository.updateStatus(maDanhGia, trangThai);
  }

  /** Xóa an toàn bằng cách chuyển sang Ẩn */
  async removeViolation(maDanhGia: number) {
    const review = await this.repository.findByIdAdmin(maDanhGia);
    if (!review) throw AppError.notFound('Không tìm thấy đánh giá');
    if (review.TrangThai === REVIEW_STATUS.HIDDEN) return review;
    if (review.TrangThai !== REVIEW_STATUS.VIOLATION) {
      throw AppError.conflict('Chỉ có thể gỡ đánh giá đã được đánh dấu vi phạm');
    }
    await this.repository.updateStatus(maDanhGia, REVIEW_STATUS.HIDDEN);
    // Giữ nguyên dạng phản hồi chi tiết cho admin
    return (await this.repository.findByIdAdmin(maDanhGia))!;
  }
}
