/** Điểm dạng 4.5 hoặc dấu gạch khi chưa có đánh giá */
export const formatRating = (average: number | null): string => (average === null ? '—' : average.toFixed(1));
