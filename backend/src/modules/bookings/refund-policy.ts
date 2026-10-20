/** Chọn mức hoàn tiền theo thời gian hủy trước nhận phòng */
export interface CancellationTier {
  soGioTruocNhanPhong: number;
  tyLeHoanTien: number;
}

/** Số giờ âm thì hoàn 0% */
export const selectRefundPercent = (tiers: readonly CancellationTier[], hoursBeforeCheckIn: number): number => {
  const eligible = tiers.filter((t) => hoursBeforeCheckIn >= t.soGioTruocNhanPhong);
  if (eligible.length === 0) return 0;
  return eligible.reduce((best, t) => (t.soGioTruocNhanPhong > best.soGioTruocNhanPhong ? t : best), eligible[0])
    .tyLeHoanTien;
};

/** Làm tròn đồng và không vượt số đã thanh toán */
export const computeRefundAmount = (amountPaid: number, refundPercent: number): number =>
  Math.min(Math.round((amountPaid * refundPercent) / 100), amountPaid);
