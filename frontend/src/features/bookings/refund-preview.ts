/** Bản xem trước mức hoàn tiền, kết quả thật do backend quyết định */
export interface CancellationTier {
  SoGioTruocNhanPhong: number;
  TyLeHoanTien: number;
}

export const selectRefundPercentPreview = (tiers: readonly CancellationTier[], hoursBeforeCheckIn: number): number => {
  const eligible = tiers.filter((t) => hoursBeforeCheckIn >= t.SoGioTruocNhanPhong);
  if (eligible.length === 0) return 0;
  return eligible.reduce((best, t) => (t.SoGioTruocNhanPhong > best.SoGioTruocNhanPhong ? t : best), eligible[0])
    .TyLeHoanTien;
};

export const computeRefundAmountPreview = (amountPaid: number, refundPercent: number): number =>
  Math.min(Math.round((amountPaid * refundPercent) / 100), amountPaid);

/** Số giờ từ hiện tại đến lúc được nhận phòng */
export const hoursBeforeCheckIn = (thoiDiemNhanPhongIso: string, now: Date = new Date()): number =>
  (Date.parse(thoiDiemNhanPhongIso) - now.getTime()) / 3_600_000;
