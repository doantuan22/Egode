/** Same rendering the app uses for VND (see frontend lib/utils formatCurrencyVND). */
export const formatVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
