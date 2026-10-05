import { QuotesRepository } from './quotes.repository';
import { CancellationPoliciesRepository } from '../cancellation-policies/cancellation-policies.repository';
import { enumerateNights, priceRoomLine, buildBookedByDate, toDateKey, type NightlyRate } from '../hotels/availability';
import { evaluatePromotion } from './promotion-pricing';
import { AppError } from '../../common/errors/app-error';
import { releaseExpiredHolds } from '../bookings/booking-lifecycle';
import type { QuoteRequestInput } from './quotes.schemas';

const toNumber = (value: unknown): number => Number(value);

export interface QuoteRoomLine {
  MaLoaiPhong: number;
  TenLoaiPhong: string;
  SoLuongYeuCau: number;
  SoPhongConLai: number;
  DuPhong: boolean;
  CoGiaDayDu: boolean;
  GiaTheoDem: number | null;
  ThanhTien: number | null;
}

export interface QuoteResponse {
  MaKhachSan: number;
  NgayNhanPhong: string;
  NgayTraPhong: string;
  SoDem: number;
  ChiTietPhong: QuoteRoomLine[];
  KhaDung: boolean;
  TongTienPhong: number;
  KhuyenMai: { MaKhuyenMai: number; MaCode: string; LoaiGiamGia: string; GiaTriGiam: number } | null;
  SoTienGiam: number;
  TongTienThanhToan: number;
  PromoHopLe: boolean;
  PromoThongBao: string | null;
  ChinhSachHuy: {
    MaChinhSachHuy: number;
    TenChinhSach: string;
    MoTa: string;
    ChiTiet: Array<{ SoGioTruocNhanPhong: number; TyLeHoanTien: number }>;
  } | null;
}

export class QuotesService {
  constructor(
    private readonly repository: QuotesRepository = new QuotesRepository(),
    private readonly cancellationPoliciesRepository: CancellationPoliciesRepository = new CancellationPoliciesRepository()
  ) {}

  async createQuote(maKhachSan: number, input: QuoteRequestInput): Promise<QuoteResponse> {
    const hotel = await this.repository.findActiveHotel(maKhachSan);
    if (!hotel) throw AppError.notFound('Không tìm thấy khách sạn');

    const nightKeys = enumerateNights(input.checkIn, input.checkOut);
    const requestedIds = input.rooms.map((r) => r.maLoaiPhong);
    await releaseExpiredHolds();
    const roomTypes = await this.repository.findRoomTypesByIds(maKhachSan, requestedIds, input.checkIn, input.checkOut);

    const foundIds = new Set(roomTypes.map((rt) => rt.MaLoaiPhong));
    const missing = requestedIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw AppError.badRequest(
        `Loại phòng không hợp lệ hoặc không thuộc khách sạn này: ${missing.join(', ')}`
      );
    }

    const chiTietPhong: QuoteRoomLine[] = input.rooms.map((line) => {
      const roomType = roomTypes.find((rt) => rt.MaLoaiPhong === line.maLoaiPhong)!;
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
      const pricing = priceRoomLine(nightKeys, ratesByDate, bookedByDate, line.soLuong);

      return {
        MaLoaiPhong: roomType.MaLoaiPhong,
        TenLoaiPhong: roomType.TenLoaiPhong,
        SoLuongYeuCau: line.soLuong,
        SoPhongConLai: pricing.available,
        DuPhong: pricing.duPhong,
        CoGiaDayDu: pricing.coGiaDayDu,
        GiaTheoDem: pricing.giaTheoDem,
        ThanhTien: pricing.thanhTien,
      };
    });

    const khaDung = chiTietPhong.every((line) => line.DuPhong && line.CoGiaDayDu);
    const tongTienPhong = chiTietPhong.reduce((sum, line) => sum + (line.ThanhTien ?? 0), 0);

    let khuyenMai: QuoteResponse['KhuyenMai'] = null;
    let soTienGiam = 0;
    let promoHopLe = false;
    let promoThongBao: string | null = null;

    if (input.promoCode) {
      const promo = await this.repository.findPromotionByCode(input.promoCode);
      if (!promo) {
        promoThongBao = 'Mã khuyến mãi không tồn tại';
      } else {
        const usedCount = await this.repository.countPromotionUsage(promo.MaKhuyenMai);
        const evalResult = evaluatePromotion(
          {
            MaKhuyenMai: promo.MaKhuyenMai,
            MaCode: promo.MaCode,
            LoaiGiamGia: promo.LoaiGiamGia,
            GiaTriGiam: toNumber(promo.GiaTriGiam),
            GiaTriDonToiThieu: toNumber(promo.GiaTriDonToiThieu),
            MucGiamToiDa: toNumber(promo.MucGiamToiDa),
            SoLuongGioiHan: promo.SoLuongGioiHan,
            NgayBatDau: promo.NgayBatDau,
            NgayKetThuc: promo.NgayKetThuc,
            TrangThai: promo.TrangThai,
          },
          tongTienPhong,
          new Date(),
          usedCount
        );

        khuyenMai = {
          MaKhuyenMai: promo.MaKhuyenMai,
          MaCode: promo.MaCode,
          LoaiGiamGia: promo.LoaiGiamGia,
          GiaTriGiam: toNumber(promo.GiaTriGiam),
        };
        promoHopLe = evalResult.valid;
        promoThongBao = evalResult.reason;
        soTienGiam = evalResult.discount;
      }
    }

    const tongTienThanhToan = tongTienPhong - soTienGiam;

    const policy = await this.cancellationPoliciesRepository.findActiveDefault();
    if (!policy) {
      throw AppError.internal('Chưa có chính sách hủy nào đang hoạt động trong hệ thống');
    }

    return {
      MaKhachSan: hotel.MaKhachSan,
      NgayNhanPhong: input.checkIn.toISOString().slice(0, 10),
      NgayTraPhong: input.checkOut.toISOString().slice(0, 10),
      SoDem: nightKeys.length,
      ChiTietPhong: chiTietPhong,
      KhaDung: khaDung,
      TongTienPhong: tongTienPhong,
      KhuyenMai: khuyenMai,
      SoTienGiam: soTienGiam,
      TongTienThanhToan: tongTienThanhToan,
      PromoHopLe: promoHopLe,
      PromoThongBao: promoThongBao,
      ChinhSachHuy: {
        MaChinhSachHuy: policy.MaChinhSachHuy,
        TenChinhSach: policy.TenChinhSach,
        MoTa: policy.MoTa,
        ChiTiet: policy.CHI_TIET_CHINH_SACH_HUY.map((c) => ({
          SoGioTruocNhanPhong: c.SoGioTruocNhanPhong,
          TyLeHoanTien: toNumber(c.TyLeHoanTien),
        })),
      },
    };
  }
}
