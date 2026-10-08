import { OwnerHotelsService } from './owner-hotels.service';
import { ReviewsRepository } from '../reviews/reviews.repository';
import { maskReviewerName } from '../reviews/reviewer-name';
import type { OwnerReviewsQuery } from './owner-reviews.schemas';

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

/** What a hotel owner may read about the reviews of their own hotels. Read-only: moderation stays with the administrator. */
export class OwnerReviewsService {
  constructor(
    private readonly reviews: ReviewsRepository = new ReviewsRepository(),
    private readonly hotels: OwnerHotelsService = new OwnerHotelsService()
  ) {}

  async list(ownerId: number, hotelId: number, query: OwnerReviewsQuery) {
    // 404 for an unknown hotel, 403 for someone else's — before anything about its reviews is read.
    await this.hotels.getOwnedHotel(ownerId, hotelId);

    const [{ items, total }, distribution, summaries] = await Promise.all([
      this.reviews.listVisibleForOwner(hotelId, query.page, query.limit, query.diemDanhGia),
      this.reviews.scoreDistribution(hotelId),
      this.reviews.ratingSummaries([hotelId]),
    ]);
    const summary = summaries.get(hotelId) ?? { DiemTrungBinh: null, SoLuongDanhGia: 0 };

    return {
      items: items.map((review) => ({
        MaDanhGia: review.MaDanhGia,
        DiemDanhGia: review.DiemDanhGia,
        NoiDung: review.NoiDung,
        // Same abbreviation the public sees: the owner learns no more about a guest than any visitor does.
        TenNguoiDanhGia: maskReviewerName(review.TAI_KHOAN.HoTen),
        HinhAnh: review.HINH_ANH_DANH_GIA.map((image) => image.URL),
        NgayNhanPhong: dateOnly(review.DAT_PHONG.NgayNhanPhong),
        NgayTraPhong: dateOnly(review.DAT_PHONG.NgayTraPhong),
      })),
      summary: { ...summary, PhanBoDiem: distribution },
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }
}
