import { HotelsRepository } from './hotels.repository';
import {
  enumerateNights,
  computeRoomTypeAvailability,
  buildBookedByDate,
  stockForStay,
  toDateKey,
  type NightlyRate,
} from './availability';
import { AppError } from '../../common/errors/app-error';
import { releaseExpiredHolds } from '../bookings/booking-lifecycle';
import { ReviewsRepository } from '../reviews/reviews.repository';
import type { SearchHotelsQuery, HotelRoomsQuery } from './hotels.schemas';
import type { ApiPaginationMeta } from '../../common/types/api-response';

interface RoomTypeWithRates {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoGiuong: number;
  SucChua: number;
  DienTich: unknown;
  LoaiGiuong: string;
  MoTa: string | null;
  HINH_ANH_LOAI_PHONG: Array<{ MaHinhAnhLoaiPhong: number; URL: string; LaAnhDaiDien: boolean }>;
  LOAI_PHONG_TIEN_NGHI: Array<{ TIEN_NGHI: { MaTienNghi: number; TenTienNghi: string; BieuTuong: string | null } }>;
  QUY_PHONG_GIA: Array<{ NgayApDung: Date; GiaPhong: unknown; SoLuongPhong: number }>;
  CHI_TIET_DAT_PHONG: Array<{ SoLuongPhong: number; DAT_PHONG: { NgayNhanPhong: Date; NgayTraPhong: Date } }>;
}

const toNumber = (value: unknown): number => Number(value);

/** Shared by search/detail/rooms: runs the availability computation for one room type. */
const priceRoomType = (roomType: RoomTypeWithRates, nightKeys: string[]) => {
  const ratesByDate = new Map<string, NightlyRate>(
    roomType.QUY_PHONG_GIA.map((r) => [
      toDateKey(r.NgayApDung),
      { giaPhong: toNumber(r.GiaPhong), soLuongPhong: r.SoLuongPhong },
    ])
  );
  const bookedByDate = buildBookedByDate(
    roomType.CHI_TIET_DAT_PHONG.map((c) => ({
      ngayNhanPhong: c.DAT_PHONG.NgayNhanPhong,
      ngayTraPhong: c.DAT_PHONG.NgayTraPhong,
      soLuongPhong: c.SoLuongPhong,
    }))
  );
  return computeRoomTypeAvailability(nightKeys, ratesByDate, bookedByDate);
};

export interface HotelSearchItem {
  MaKhachSan: number;
  TenKhachSan: string;
  DiaChiChiTiet: string;
  HangSao: number;
  DiaPhuong: { MaDiaPhuong: number; TenThanhPho: string; TenTinh: string; QuocGia: string };
  AnhDaiDien: string | null;
  GiaTuDauTu: number | null;
  ConPhong: boolean;
  /** Visible reviews only; null average when there is none. */
  DiemTrungBinh: number | null;
  SoLuongDanhGia: number;
}

export class HotelsService {
  constructor(
    private readonly hotelsRepository: HotelsRepository = new HotelsRepository(),
    private readonly reviewsRepository: ReviewsRepository = new ReviewsRepository()
  ) {}

  async search(query: SearchHotelsQuery): Promise<{ items: HotelSearchItem[]; pagination: ApiPaginationMeta }> {
    const nightKeys = enumerateNights(query.checkIn, query.checkOut);

    // An unpaid hold past its timeout must not hide rooms from the result.
    await releaseExpiredHolds();
    const hotels = await this.hotelsRepository.findCandidateHotels({
      location: query.location,
      starRating: query.starRating,
      amenityIds: query.amenities,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
    });

    // Guests may be split over several rooms, so the question is whether the hotel's rooms TOGETHER can hold the
    // party: Σ (SucChua × rooms). A hotel that could never hold it (even with every room free) is not listed;
    // one that could but has too few rooms free on these dates is listed as "hết phòng".
    const hosts = (hotel: (typeof hotels)[number]) => {
      let inStock = 0;
      let free = 0;
      let cheapest = Infinity;
      for (const roomType of hotel.LOAI_PHONG) {
        const priced = priceRoomType(roomType, nightKeys);
        if (priced.totalPrice === null) continue; // a night without a price cannot be sold
        inStock += roomType.SucChua * stockForStay(nightKeys, roomType.QUY_PHONG_GIA);
        free += roomType.SucChua * priced.available;
        if (priced.available > 0) cheapest = Math.min(cheapest, priced.totalPrice / priced.nights);
      }
      return { inStock, free, cheapest };
    };

    let items: HotelSearchItem[] = hotels
      .map((hotel) => ({ hotel, capacity: hosts(hotel) }))
      .filter(({ capacity }) => capacity.inStock >= query.guests)
      .map(({ hotel, capacity }) => {
      const conPhong = capacity.free >= query.guests;
      const giaTuDauTu = conPhong && Number.isFinite(capacity.cheapest) ? capacity.cheapest : null;
      const anhDaiDien =
        hotel.HINH_ANH_KHACH_SAN.find((img) => img.AnhDaiDien)?.URL ??
        hotel.HINH_ANH_KHACH_SAN[0]?.URL ??
        null;

      return {
        MaKhachSan: hotel.MaKhachSan,
        TenKhachSan: hotel.TenKhachSan,
        DiaChiChiTiet: hotel.DiaChiChiTiet,
        HangSao: hotel.HangSao,
        DiaPhuong: hotel.DIA_PHUONG,
        AnhDaiDien: anhDaiDien,
        GiaTuDauTu: giaTuDauTu,
        ConPhong: conPhong,
        DiemTrungBinh: null,
        SoLuongDanhGia: 0,
      };
    });

    // Price filtering depends on computed availability, so it happens here,
    // in-memory, after the DB query — see hotels.repository.ts for the note
    // on why this scales fine for M2 (dev-scale candidate sets) but would
    // need query-level filtering at real production scale.
    if (query.minPrice !== undefined) {
      items = items.filter((h) => h.GiaTuDauTu !== null && h.GiaTuDauTu >= query.minPrice!);
    }
    if (query.maxPrice !== undefined) {
      items = items.filter((h) => h.GiaTuDauTu !== null && h.GiaTuDauTu <= query.maxPrice!);
    }

    items = this.sortHotels(items, query.sort);

    const total = items.length;
    const start = (query.page - 1) * query.limit;
    const paged = items.slice(start, start + query.limit);

    // Ratings are looked up for the page being returned only, in one grouped query.
    const ratings = await this.reviewsRepository.ratingSummaries(paged.map((item) => item.MaKhachSan));
    for (const item of paged) {
      const rating = ratings.get(item.MaKhachSan);
      if (rating) Object.assign(item, rating);
    }

    return {
      items: paged,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  private sortHotels(items: HotelSearchItem[], sort: SearchHotelsQuery['sort']): HotelSearchItem[] {
    const withPrice = (h: HotelSearchItem) => h.GiaTuDauTu ?? Number.POSITIVE_INFINITY;
    switch (sort) {
      case 'price_desc':
        return [...items].sort((a, b) => (b.GiaTuDauTu ?? -1) - (a.GiaTuDauTu ?? -1));
      case 'star_desc':
        return [...items].sort((a, b) => b.HangSao - a.HangSao);
      case 'newest':
        return [...items].sort((a, b) => b.MaKhachSan - a.MaKhachSan);
      case 'price_asc':
      default:
        return [...items].sort((a, b) => withPrice(a) - withPrice(b));
    }
  }

  async getDetail(maKhachSan: number) {
    const hotel = await this.hotelsRepository.findActiveHotelById(maKhachSan);
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');

    const rating = (await this.reviewsRepository.ratingSummaries([maKhachSan])).get(maKhachSan);
    return {
      DanhGia: rating ?? { DiemTrungBinh: null, SoLuongDanhGia: 0 },
      MaKhachSan: hotel.MaKhachSan,
      TenKhachSan: hotel.TenKhachSan,
      DiaChiChiTiet: hotel.DiaChiChiTiet,
      MoTa: hotel.MoTa,
      HangSao: hotel.HangSao,
      GioNhanPhong: hotel.GioNhanPhong,
      GioTraPhong: hotel.GioTraPhong,
      DiaPhuong: hotel.DIA_PHUONG,
      HinhAnh: hotel.HINH_ANH_KHACH_SAN.map((img) => ({
        MaHinhAnh: img.MaHinhAnh,
        URL: img.URL,
        AnhDaiDien: img.AnhDaiDien,
      })),
      TienNghi: hotel.KHACH_SAN_TIEN_NGHI.map((kt) => kt.TIEN_NGHI),
    };
  }

  async getRooms(maKhachSan: number, query: HotelRoomsQuery) {
    const exists = await this.hotelsRepository.hotelExists(maKhachSan);
    if (!exists) throw AppError.notFound('Không tìm thấy khách sạn');

    const nightKeys = enumerateNights(query.checkIn, query.checkOut);
    await releaseExpiredHolds();
    // Every active room type is listed with its SucChua: a party can be spread over several rooms, so a room that
    // is "too small for everyone" is not hidden. The capacity check happens on the quote and the booking.
    const roomTypes = await this.hotelsRepository.findRoomTypesForHotel(maKhachSan, query.checkIn, query.checkOut);

    return roomTypes.map((rt) => {
      const priced = priceRoomType(rt, nightKeys);
      return {
        MaLoaiPhong: rt.MaLoaiPhong,
        TenLoaiPhong: rt.TenLoaiPhong,
        SoGiuong: rt.SoGiuong,
        SucChua: rt.SucChua,
        DienTich: toNumber(rt.DienTich),
        LoaiGiuong: rt.LoaiGiuong,
        MoTa: rt.MoTa,
        HinhAnh: rt.HINH_ANH_LOAI_PHONG.map((img) => ({
          MaHinhAnhLoaiPhong: img.MaHinhAnhLoaiPhong,
          URL: img.URL,
          LaAnhDaiDien: img.LaAnhDaiDien,
        })),
        TienNghi: rt.LOAI_PHONG_TIEN_NGHI.map((lt) => lt.TIEN_NGHI),
        GiaTheoDem: priced.totalPrice !== null ? Math.round(priced.totalPrice / priced.nights) : null,
        TongTien: priced.totalPrice,
        SoDem: priced.nights,
        SoPhongConLai: priced.available,
        ConHang: priced.available > 0,
      };
    });
  }
}
