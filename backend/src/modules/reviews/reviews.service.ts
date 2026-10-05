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

/**
 * The booking was already reviewed. Two shapes of the same race: P2002 when both
 * inserts collide on UQ_DANH_GIA_MaDatPhong, and P2014 when the winner has already
 * committed by the time the loser's nested connect to DAT_PHONG checks the
 * one-review-per-booking relation.
 */
const isDuplicateReviewError = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  (err.code === 'P2002' || (err.code === 'P2014' && err.meta?.relation === 'DANH_GIAToDAT_PHONG'));

export class ReviewsService {
  constructor(private readonly repository: ReviewsRepository = new ReviewsRepository()) {}

  /** Ownership + eligibility (RB9: booking must actually be "Hoàn tất") — never trusted from the client. */
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

    // BUG-005: images reach Cloudinary BEFORE the review row exists, so any
    // failure from the first upload up to the DB commit would orphan them.
    // Track exactly what THIS request uploaded and delete it if anything throws.
    const uploadedImages: UploadImageResult[] = [];
    try {
      for (const dataUri of input.hinhAnh ?? []) {
        // Recorded right after each success, so a later failure still knows about it.
        uploadedImages.push(await CloudinaryIntegration.uploadImage(dataUri, REVIEW_IMAGE_FOLDER));
      }

      return await this.repository.create(
        {
          maDatPhong,
          maKhachHang: customerId,
          maKhachSan: booking.MaKhachSan,
          diemDanhGia: input.diemDanhGia,
          noiDung: input.noiDung ?? null,
          trangThai: REVIEW_STATUS.PENDING,
        },
        uploadedImages.map((image) => image.url)
      );
    } catch (err) {
      await this.deleteUploadedImages(uploadedImages);
      // RB26 (UQ_DANH_GIA_MaDatPhong) — guards the same-instant double-submit race the findByBookingId check above can't fully close.
      if (isDuplicateReviewError(err)) {
        throw AppError.conflict('Đặt phòng này đã được đánh giá');
      }
      throw err;
    }
  }

  /**
   * Best-effort rollback of this request's Cloudinary uploads. Never throws, so
   * it cannot mask the error that triggered it, and one failed delete never
   * stops the others. Failures log only the publicId and the error message —
   * no image data, URL or credentials.
   */
  private async deleteUploadedImages(images: UploadImageResult[]): Promise<void> {
    if (images.length === 0) return;
    const results = await Promise.allSettled(images.map((image) => CloudinaryIntegration.deleteImage(image.publicId)));
    results.forEach((result, index) => {
      const publicId = images[index].publicId;
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error('Review image cleanup failed', { publicId, reason });
      } else if (!result.value) {
        console.error('Review image cleanup failed', { publicId, reason: 'Cloudinary did not confirm deletion' });
      }
    });
  }

  /** null when the customer hasn't reviewed this booking yet — not an error (same convention as GET /partners/me). */
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

  /** The visible reviews of a hotel that is itself public, newest first, with the reviewer's name abbreviated. */
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

  /** Customer can never reach this — no TrangThai field exists anywhere in the customer-facing create schema, and this action is admin-only routed. */
  async moderate(maDanhGia: number, trangThai: string) {
    const review = await this.repository.findByIdAdmin(maDanhGia);
    if (!review) throw AppError.notFound('Không tìm thấy đánh giá');
    return this.repository.updateStatus(maDanhGia, trangThai);
  }

  /**
   * UC37 safe-delete. The row and review images stay available to admins for
   * audit/history; the existing `Ẩn` state removes a flagged review from
   * public-visible states. A second request is deliberately idempotent.
   */
  async removeViolation(maDanhGia: number) {
    const review = await this.repository.findByIdAdmin(maDanhGia);
    if (!review) throw AppError.notFound('Không tìm thấy đánh giá');
    if (review.TrangThai === REVIEW_STATUS.HIDDEN) return review;
    if (review.TrangThai !== REVIEW_STATUS.VIOLATION) {
      throw AppError.conflict('Chỉ có thể gỡ đánh giá đã được đánh dấu vi phạm');
    }
    await this.repository.updateStatus(maDanhGia, REVIEW_STATUS.HIDDEN);
    // Preserve the admin-detail response contract after the state transition.
    return (await this.repository.findByIdAdmin(maDanhGia))!;
  }
}
