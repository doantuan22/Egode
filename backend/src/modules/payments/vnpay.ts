/** Hàm thuần ký và kiểm tra chữ ký cho VNPAY sandbox */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';

export type VnpayParams = Record<string, string | number>;

/** Sắp xếp khóa và chuẩn hóa giá trị như mẫu của VNPAY */
const encodeValue = (value: string | number): string =>
  encodeURIComponent(String(value)).replace(/%20/g, '+');

const buildSignData = (params: VnpayParams): string => {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${encodeURIComponent(k)}=${encodeValue(params[k])}`).join('&');
};

export const signVnpayParams = (params: VnpayParams, hashSecret: string): string => {
  const signData = buildSignData(params);
  return createHmac('sha512', hashSecret).update(Buffer.from(signData, 'utf-8')).digest('hex');
};

/** Định dạng yyyyMMddHHmmss theo giờ Việt Nam */
export const toVnpayDate = (date: Date): string => {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`;
};

export const generateTxnRef = (): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `PAY${stamp}${rand}`; // well under THANH_TOAN.MaGiaoDichDoiTac VARCHAR(100)
};

export const generateRefundRef = (): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `RF${stamp}${rand}`;
};

export interface BuildPaymentUrlInput {
  txnRef: string;
  /** Số tiền VND phải lấy từ đơn đặt phòng */
  amount: number;
  orderInfo: string;
  ipAddr: string;
  createDate?: Date;
}

/** Tạo URL trang thanh toán VNPAY kèm chữ ký */
export const buildPaymentUrl = (input: BuildPaymentUrlInput): string => {
  const params: VnpayParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: env.VNPAY_TMN_CODE,
    vnp_Amount: Math.round(input.amount * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: env.VNPAY_RETURN_URL,
    vnp_IpAddr: input.ipAddr,
    vnp_CreateDate: toVnpayDate(input.createDate ?? new Date()),
  };
  const secureHash = signVnpayParams(params, env.VNPAY_HASH_SECRET);
  const query = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeValue(params[k])}`)
    .concat(`vnp_SecureHash=${secureHash}`)
    .join('&');
  return `${env.VNPAY_PAYMENT_URL}?${query}`;
};

/** Kiểm tra chữ ký vnp_SecureHash của callback */
export const verifyVnpaySignature = (query: Record<string, unknown>): boolean => {
  if (Object.keys(query).length > 50) return false;
  const receivedHash = typeof query.vnp_SecureHash === 'string' ? query.vnp_SecureHash : '';
  if (!/^[a-f0-9]{128}$/i.test(receivedHash)) return false;

  const params: VnpayParams = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') continue;
    if (value === undefined) continue;
    if (!/^vnp_[A-Za-z0-9_]+$/.test(key) || (typeof value !== 'string' && typeof value !== 'number')) return false;
    if (String(value).length > 1024) return false;
    params[key] = value;
  }
  const expectedHash = signVnpayParams(params, env.VNPAY_HASH_SECRET);
  return timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(receivedHash, 'hex'));
};

/** Mã phản hồi IPN do VNPAY quy định */
export const VNPAY_IPN_CODE = {
  SUCCESS: '00',
  ORDER_NOT_FOUND: '01',
  ORDER_ALREADY_CONFIRMED: '02',
  INVALID_AMOUNT: '04',
  INVALID_SIGNATURE: '97',
  UNKNOWN_ERROR: '99',
} as const;

/** Gói txnRef, số giao dịch và ngày thanh toán vào một mã */
export const encodeGatewayRef = (txnRef: string, transactionNo?: string, payDate?: string): string =>
  transactionNo ? `${txnRef}:${transactionNo}:${payDate ?? ''}` : txnRef;

export const decodeGatewayRef = (raw: string): { txnRef: string; transactionNo: string | null; payDate: string | null } => {
  const [txnRef, transactionNo, payDate] = raw.split(':');
  return { txnRef, transactionNo: transactionNo || null, payDate: payDate || null };
};
