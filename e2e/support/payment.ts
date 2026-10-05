import { createHmac } from 'node:crypto';
import path from 'node:path';
import type { Page } from '@playwright/test';

/**
 * The hosted VNPAY page is the one external page the browser leaves our app for. We replace ONLY that page: when the
 * browser navigates to the gateway, we act as the gateway would — take the signed payment request the backend built,
 * and send the browser to the backend's real return endpoint with a genuine, correctly signed answer (same HMAC-SHA512
 * rule, the real hash secret from backend/.env). The backend verifies that signature, the amount and the txn reference
 * exactly as in production; nothing on our side is mocked.
 */
process.loadEnvFile(path.resolve(__dirname, '../../backend/.env'));

const encodeValue = (value: string | number) => encodeURIComponent(String(value)).replace(/%20/g, '+');
const sign = (params: Record<string, string | number>, secret: string) => {
  const data = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeValue(params[k])}`)
    .join('&');
  return createHmac('sha512', secret).update(Buffer.from(data, 'utf-8')).digest('hex');
};

const vnpayDate = (date: Date) => {
  const vn = new Date(date.getTime() + 7 * 3600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
};

export interface GatewayVisit {
  txnRef: string;
  amountVnd: number;
}

/**
 * From now on, any navigation to the VNPAY payment page is answered like the gateway: `success` pays, `failed` is a
 * declined card. Returns the list of payment requests the gateway saw (to assert amount and reference).
 */
export async function simulateGateway(page: Page, outcome: 'success' | 'failed' = 'success'): Promise<GatewayVisit[]> {
  const visits: GatewayVisit[] = [];
  const secret = process.env.VNPAY_HASH_SECRET!;
  const tmnCode = process.env.VNPAY_TMN_CODE!;
  await page.route(/https:\/\/sandbox\.vnpayment\.vn\/.*/, async (route) => {
    const request = new URL(route.request().url());
    const q = request.searchParams;
    const txnRef = q.get('vnp_TxnRef')!;
    const amount = Number(q.get('vnp_Amount'));
    visits.push({ txnRef, amountVnd: amount / 100 });

    const answer: Record<string, string | number> = {
      vnp_Amount: amount,
      vnp_BankCode: 'NCB',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: q.get('vnp_OrderInfo') ?? '',
      vnp_PayDate: vnpayDate(new Date()),
      vnp_ResponseCode: outcome === 'success' ? '00' : '24',
      vnp_TmnCode: tmnCode,
      vnp_TransactionNo: String(14_000_000 + Math.floor(Math.random() * 999_999)),
      vnp_TransactionStatus: outcome === 'success' ? '00' : '02',
      vnp_TxnRef: txnRef,
    };
    const returnUrl = q.get('vnp_ReturnUrl')!;
    const query = Object.keys(answer)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeValue(answer[k])}`)
      .concat(`vnp_SecureHash=${sign(answer, secret)}`)
      .join('&');
    await route.fulfill({ status: 302, headers: { Location: `${returnUrl}?${query}` }, body: '' });
  });
  return visits;
}
