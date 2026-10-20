/** Định dạng tiền VND giống ứng dụng */
export const formatVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
