/** Thanh toán và hoàn tiền giả lập giữ hiệu ứng đang xử lý một lúc */
const configured = import.meta.env.VITE_SIMULATION_DELAY_MS;
const parsed = configured === undefined || configured === '' ? NaN : Number(configured);

/** Thời gian tối thiểu của hiệu ứng, tính bằng ms */
export const SIMULATION_DELAY_MS = Number.isFinite(parsed) && parsed >= 0 ? parsed : 2600;

/** Chờ cả công việc và độ trễ tối thiểu */
export async function withMinimumDelay<T>(work: Promise<T>, ms: number = SIMULATION_DELAY_MS): Promise<T> {
  const timer = new Promise<void>((resolve) => setTimeout(resolve, ms));
  const [result] = await Promise.allSettled([work, timer]);
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}
