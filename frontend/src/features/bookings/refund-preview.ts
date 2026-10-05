/**
 * Preview-only mirror of backend/src/modules/bookings/refund-policy.ts —
 * lets the Cancel dialog show an estimated refund BEFORE the customer
 * confirms, without a round trip. The backend recomputes this exact same
 * logic independently at cancel time and is always the authoritative
 * source of the final amount (this file must never be the thing that
 * decides money) — see M6 report §5.
 */
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

/**
 * Hours from `now` to the moment guests may check in — the same instant the server cuts the refund tiers at: the
 * stay's date plus the hotel's check-in time, in Vietnam time. The server sends it ready-made
 * (BookingDetail.ThoiDiemNhanPhong, an ISO instant), so no time-zone arithmetic happens in the browser.
 */
export const hoursBeforeCheckIn = (thoiDiemNhanPhongIso: string, now: Date = new Date()): number =>
  (Date.parse(thoiDiemNhanPhongIso) - now.getTime()) / 3_600_000;
