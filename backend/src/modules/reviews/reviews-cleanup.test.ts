import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import {
  createTestAccount,
  deleteTestAccount,
  createTestDiaPhuong,
  deleteTestDiaPhuong,
  createTestHotel,
  deleteTestHotel,
  createTestCancellationPolicy,
  deleteTestCancellationPolicy,
  createTestBookingDirect,
} from '../../test/factories';
import { CloudinaryIntegration } from '../../integrations/cloudinary.integration';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { AppError } from '../../common/errors/app-error';
import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { ROLE_NAMES } from '../../common/constants/roles';
import { BOOKING_STATUS } from '../../common/constants/hotel-status';

/** Dọn ảnh Cloudinary mồ côi khi tạo đánh giá thất bại */
vi.mock('../../integrations/cloudinary.integration', () => ({
  CloudinaryIntegration: { uploadImage: vi.fn(), deleteImage: vi.fn() },
}));

const upload = vi.mocked(CloudinaryIntegration.uploadImage);
const remove = vi.mocked(CloudinaryIntegration.deleteImage);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Data URI hợp lệ kèm nhãn nhận dạng */
const png = (tag: string) => `data:image/png;base64,${Buffer.concat([PNG_SIGNATURE, Buffer.from(tag)]).toString('base64')}`;
const tagOf = (dataUri: string) => Buffer.from(dataUri.split(',')[1], 'base64').subarray(PNG_SIGNATURE.length).toString();
const publicIdOf = (tag: string) => `hotel-booking/reviews/${tag}`;
const urlOf = (tag: string) => `https://res.cloudinary.com/demo/image/upload/v1/hotel-booking/reviews/${tag}.jpg`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Giả lập upload thành công hoặc lỗi theo nhãn */
const fakeUpload = (opts: { delayMs?: number; failTags?: string[] } = {}) =>
  upload.mockImplementation(async (dataUri: string) => {
    if (opts.delayMs) await sleep(opts.delayMs);
    const tag = tagOf(dataUri);
    if (opts.failTags?.includes(tag)) throw new Error(`Cloudinary upload failed for ${tag}`);
    return { url: urlOf(tag), publicId: publicIdOf(tag) };
  });

const deletedPublicIds = () => remove.mock.calls.map(([publicId]) => publicId).sort();

const addDays = (days: number): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const accountIds: number[] = [];
const diaPhuongIds: number[] = [];
const hotelIds: number[] = [];
const policyIds: number[] = [];
let hotelId: number;
let policyId: number;
let customerId: number;

const newBooking = async () =>
  (await createTestBookingDirect(customerId, hotelId, policyId, addDays(-10), addDays(-8), { trangThai: BOOKING_STATUS.COMPLETED })).MaDatPhong;

const reviewCount = (maDatPhong: number) => getPrismaClient().dANH_GIA.count({ where: { MaDatPhong: maDatPhong } });

let run: string;
const service = new ReviewsService();

beforeAll(async () => {
  const owner = await createTestAccount({ role: ROLE_NAMES.PARTNER });
  accountIds.push(owner.account.MaTaiKhoan);
  const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
  accountIds.push(customer.account.MaTaiKhoan);
  customerId = customer.account.MaTaiKhoan;
  const diaPhuong = await createTestDiaPhuong();
  diaPhuongIds.push(diaPhuong.MaDiaPhuong);
  const hotel = await createTestHotel(owner.account.MaTaiKhoan, diaPhuong.MaDiaPhuong);
  hotelIds.push(hotel.MaKhachSan);
  hotelId = hotel.MaKhachSan;
  const policy = await createTestCancellationPolicy([{ soGioTruocNhanPhong: 24, tyLeHoanTien: 50 }]);
  policyIds.push(policy.MaChinhSachHuy);
  policyId = policy.MaChinhSachHuy;
});

afterAll(async () => {
  const prisma = getPrismaClient();
  await prisma.hINH_ANH_DANH_GIA.deleteMany({ where: { DANH_GIA: { MaKhachSan: hotelId } } });
  await prisma.dANH_GIA.deleteMany({ where: { MaKhachSan: hotelId } });
  await prisma.dAT_PHONG.deleteMany({ where: { MaKhachSan: hotelId } });
  await Promise.all(policyIds.map((id) => deleteTestCancellationPolicy(id)));
  await Promise.all(hotelIds.map((id) => deleteTestHotel(id)));
  await Promise.all(accountIds.map((id) => deleteTestAccount(id)));
  await Promise.all(diaPhuongIds.map((id) => deleteTestDiaPhuong(id)));
});

let errorLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  upload.mockReset();
  remove.mockReset();
  remove.mockResolvedValue(true);
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createReview — Cloudinary cleanup (BUG-005)', () => {
  it('A. duplicate-review race: exactly one review is created, the loser gets 409 and ALL of its images are deleted, the winner keeps its images', async () => {
    const ROUNDS = 5;
    for (let round = 0; round < ROUNDS; round++) {
      upload.mockReset();
      remove.mockReset();
      remove.mockResolvedValue(true);
      // Độ trễ giữ hai request cùng ở bước upload
      fakeUpload({ delayMs: 150 });

      const maDatPhong = await newBooking();
      const tagsA = [`${run}r${round}a1`, `${run}r${round}a2`];
      const tagsB = [`${run}r${round}b1`, `${run}r${round}b2`];
      const [resA, resB] = await Promise.allSettled([
        service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: tagsA.map(png) }),
        service.createReview(maDatPhong, customerId, { diemDanhGia: 4, hinhAnh: tagsB.map(png) }),
      ]);

      const context = `round ${round}`;
      const winners = [resA, resB].filter((r) => r.status === 'fulfilled');
      const losers = [resA, resB].filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(winners, context).toHaveLength(1);
      expect(losers, context).toHaveLength(1);
      expect(losers[0].reason, context).toBeInstanceOf(AppError);
      expect(losers[0].reason.statusCode, context).toBe(409);
      expect(losers[0].reason.message, context).toBe('Đặt phòng này đã được đánh giá');

      expect(upload, `${context}: both requests must have uploaded`).toHaveBeenCalledTimes(4);
      expect(await reviewCount(maDatPhong), context).toBe(1);

      const winnerIsA = resA.status === 'fulfilled';
      const winnerTags = winnerIsA ? tagsA : tagsB;
      const loserTags = winnerIsA ? tagsB : tagsA;
      expect(deletedPublicIds(), context).toEqual(loserTags.map(publicIdOf).sort());

      const stored = await getPrismaClient().hINH_ANH_DANH_GIA.findMany({ where: { DANH_GIA: { MaDatPhong: maDatPhong } } });
      expect(stored.map((s) => s.URL).sort(), context).toEqual(winnerTags.map(urlOf).sort());
    }
  }, 60_000);

  it('B. partial upload failure: images 1 and 2 are cleaned up, image 3 error is preserved, no review is created', async () => {
    const [t1, t2, t3] = [`${run}1`, `${run}2`, `${run}3`];
    fakeUpload({ failTags: [t3] });
    const create = vi.spyOn(ReviewsRepository.prototype, 'create');
    const maDatPhong = await newBooking();

    await expect(service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [t1, t2, t3].map(png) })).rejects.toThrow(
      `Cloudinary upload failed for ${t3}`
    );

    expect(upload).toHaveBeenCalledTimes(3);
    expect(deletedPublicIds()).toEqual([publicIdOf(t1), publicIdOf(t2)].sort());
    expect(create).not.toHaveBeenCalled();
    expect(await reviewCount(maDatPhong)).toBe(0);
  });

  it('B2. the very first upload failing deletes nothing (nothing was uploaded) and keeps the error', async () => {
    const [t1, t2] = [`${run}1`, `${run}2`];
    fakeUpload({ failTags: [t1] });
    const maDatPhong = await newBooking();

    await expect(service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [t1, t2].map(png) })).rejects.toThrow('Cloudinary upload failed');
    expect(remove).not.toHaveBeenCalled();
    expect(await reviewCount(maDatPhong)).toBe(0);
  });

  it('C. generic DB failure (not P2002): every uploaded image is cleaned up and the original error is rethrown unchanged', async () => {
    const tags = [`${run}1`, `${run}2`, `${run}3`];
    fakeUpload();
    const dbError = new Error('connection to database lost');
    vi.spyOn(ReviewsRepository.prototype, 'create').mockRejectedValueOnce(dbError);
    const maDatPhong = await newBooking();

    const outcome = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: tags.map(png) }).catch((e: unknown) => e);

    expect(outcome).toBe(dbError);
    expect(deletedPublicIds()).toEqual(tags.map(publicIdOf).sort());
    expect(await reviewCount(maDatPhong)).toBe(0);
  });

  it('C2. a REAL DB failure after the review row is written leaves no half-written review (repository.create is atomic) and no orphan images', async () => {
    const [t1, t2] = [`${run}1`, `${run}2`];
    // URL quá dài làm chèn ảnh thất bại
    upload.mockImplementation(async (dataUri: string) => {
      const tag = tagOf(dataUri);
      return { url: `${urlOf(tag)}?pad=${'x'.repeat(600)}`, publicId: publicIdOf(tag) };
    });
    const maDatPhong = await newBooking();

    const outcome = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [t1, t2].map(png) }).catch((e: unknown) => e);

    expect(outcome).toBeInstanceOf(Error);
    expect(outcome).not.toBeInstanceOf(AppError);
    expect(await reviewCount(maDatPhong)).toBe(0);
    expect(await getPrismaClient().hINH_ANH_DANH_GIA.count({ where: { DANH_GIA: { MaDatPhong: maDatPhong } } })).toBe(0);
    expect(deletedPublicIds()).toEqual([publicIdOf(t1), publicIdOf(t2)].sort());
  });

  it('D. a failing delete does not stop the other deletes, does not hide the original error, and is logged', async () => {
    const tags = [`${run}1`, `${run}2`, `${run}3`];
    fakeUpload();
    remove.mockImplementation(async (publicId: string) => {
      if (publicId === publicIdOf(tags[1])) throw new Error('Cloudinary 503');
      return true;
    });
    const dbError = new Error('deadlock victim');
    vi.spyOn(ReviewsRepository.prototype, 'create').mockRejectedValueOnce(dbError);
    const maDatPhong = await newBooking();

    const outcome = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: tags.map(png) }).catch((e: unknown) => e);

    expect(outcome).toBe(dbError);
    expect(deletedPublicIds()).toEqual(tags.map(publicIdOf).sort());
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith('Review image cleanup failed', { publicId: publicIdOf(tags[1]), errorType: 'Error' });
    // Log không chứa dữ liệu nhạy cảm
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain('base64');
    expect(logged).not.toContain('res.cloudinary.com');
  });

  it('D2. a delete that Cloudinary does not confirm (resolves false) is logged too', async () => {
    const tags = [`${run}1`, `${run}2`];
    fakeUpload();
    remove.mockImplementation(async (publicId: string) => publicId !== publicIdOf(tags[0]));
    vi.spyOn(ReviewsRepository.prototype, 'create').mockRejectedValueOnce(new Error('boom'));
    const maDatPhong = await newBooking();

    await expect(service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: tags.map(png) })).rejects.toThrow('boom');
    expect(errorLog).toHaveBeenCalledWith('Review image cleanup failed', {
      publicId: publicIdOf(tags[0]),
      reason: 'Cloudinary did not confirm deletion',
    });
  });

  it('D3. a duplicate-review 409 (P2002) is still returned when cleanup also fails', async () => {
    const [t1, t2] = [`${run}1`, `${run}2`];
    fakeUpload();
    remove.mockRejectedValue(new Error('Cloudinary down'));
    vi.spyOn(ReviewsRepository.prototype, 'create').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' })
    );
    const maDatPhong = await newBooking();

    const outcome = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [t1, t2].map(png) }).catch((e: unknown) => e);

    expect(outcome).toBeInstanceOf(AppError);
    expect((outcome as AppError).statusCode).toBe(409);
    expect((outcome as AppError).message).toBe('Đặt phòng này đã được đánh giá');
    expect(remove).toHaveBeenCalledTimes(2);
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it('D4. a winner committing between the pre-check and the loser insert (Prisma P2014, real DB) is also a 409 with full cleanup', async () => {
    const [t1, t2] = [`${run}1`, `${run}2`];
    fakeUpload();
    const maDatPhong = await newBooking();
    // Làm bước kiểm tra trước bỏ sót đánh giá đã có
    vi.spyOn(ReviewsRepository.prototype, 'findByBookingId').mockResolvedValueOnce(null);
    await getPrismaClient().dANH_GIA.create({
      data: { MaDatPhong: maDatPhong, MaKhachHang: customerId, MaKhachSan: hotelId, DiemDanhGia: 3, TrangThai: 'Chờ duyệt' },
    });

    const outcome = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [t1, t2].map(png) }).catch((e: unknown) => e);

    expect(outcome).toBeInstanceOf(AppError);
    expect((outcome as AppError).statusCode).toBe(409);
    expect(deletedPublicIds()).toEqual([publicIdOf(t1), publicIdOf(t2)].sort());
    expect(await reviewCount(maDatPhong)).toBe(1);
  });

  it('E. success path: URLs are persisted, deleteImage is never called', async () => {
    const tags = [`${run}1`, `${run}2`];
    fakeUpload();
    const maDatPhong = await newBooking();

    const review = await service.createReview(maDatPhong, customerId, { diemDanhGia: 5, noiDung: 'Tốt', hinhAnh: tags.map(png) });

    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(review.HINH_ANH_DANH_GIA.map((h) => h.URL)).toEqual(tags.map(urlOf));
    const stored = await getPrismaClient().hINH_ANH_DANH_GIA.findMany({ where: { DANH_GIA: { MaDatPhong: maDatPhong } } });
    expect(stored.map((s) => s.URL).sort()).toEqual(tags.map(urlOf).sort());
  });

  it('F. a review without images works and touches Cloudinary not at all', async () => {
    const maDatPhong = await newBooking();

    const review = await service.createReview(maDatPhong, customerId, { diemDanhGia: 4 });

    expect(review.HINH_ANH_DANH_GIA).toHaveLength(0);
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(await reviewCount(maDatPhong)).toBe(1);
  });

  it('F2. a failing no-image review (DB error) has nothing to clean up and rethrows', async () => {
    vi.spyOn(ReviewsRepository.prototype, 'create').mockRejectedValueOnce(new Error('boom'));
    const maDatPhong = await newBooking();

    await expect(service.createReview(maDatPhong, customerId, { diemDanhGia: 4 })).rejects.toThrow('boom');
    expect(remove).not.toHaveBeenCalled();
  });

  it('a request that fails validation before any upload (e.g. already reviewed) uploads and deletes nothing', async () => {
    fakeUpload();
    const maDatPhong = await newBooking();
    await service.createReview(maDatPhong, customerId, { diemDanhGia: 5 });
    upload.mockClear();

    await expect(service.createReview(maDatPhong, customerId, { diemDanhGia: 5, hinhAnh: [png(`${run}1`)] })).rejects.toMatchObject({ statusCode: 409 });
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
