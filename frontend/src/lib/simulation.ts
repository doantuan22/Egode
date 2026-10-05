/**
 * Payment and refund are simulated (PAYMENT_PROVIDER=simulated on the backend): the server finishes them at once, so the
 * client keeps its "processing" animation on screen for a moment, as a real bank/gateway round trip would. The record in
 * the database is written by the server call itself, not by this delay.
 */
const configured = import.meta.env.VITE_SIMULATION_DELAY_MS;
const parsed = configured === undefined || configured === '' ? NaN : Number(configured);

/** How long the processing animation stays at least (ms). */
export const SIMULATION_DELAY_MS = Number.isFinite(parsed) && parsed >= 0 ? parsed : 2600;

/** Waits for `work` AND for the minimum delay, then returns its result (or throws its error — also after the delay). */
export async function withMinimumDelay<T>(work: Promise<T>, ms: number = SIMULATION_DELAY_MS): Promise<T> {
  const timer = new Promise<void>((resolve) => setTimeout(resolve, ms));
  const [result] = await Promise.allSettled([work, timer]);
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}
