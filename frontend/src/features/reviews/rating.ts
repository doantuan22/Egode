/** "4.5", or "—" when the hotel has no visible review yet. */
export const formatRating = (average: number | null): string => (average === null ? '—' : average.toFixed(1));
