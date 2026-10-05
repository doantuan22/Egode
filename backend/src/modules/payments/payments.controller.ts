import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';
import { sendSuccess } from '../../common/utils/response';
import { env } from '../../config/env';

const resolveIp = (req: Request): string => (req.ip ?? '127.0.0.1').replace('::ffff:', '');

export class PaymentsController {
  constructor(private readonly service: PaymentsService = new PaymentsService()) {}

  createVnpayPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.createVnpayPayment(id, req.user!.maTaiKhoan, resolveIp(req));
      sendSuccess(res, result, undefined, 201);
    } catch (error) {
      next(error);
    }
  };

  /** Simulated payment (PAYMENT_PROVIDER=simulated): pays and confirms in one call, no redirect. */
  paySimulated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.paySimulated(id, req.user!.maTaiKhoan);
      sendSuccess(res, result, 'Thanh toán thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  /** Which payment mode is active, so the client knows whether to redirect to a gateway or run the simulated flow. */
  getConfig = (_req: Request, res: Response): void => {
    sendSuccess(res, this.service.getConfig());
  };

  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.getPaymentStatus(id, req.user!.maTaiKhoan);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** Browser redirect after paying on the VNPAY-hosted page — display-only; the IPN below is the authoritative confirmation. */
  vnpayReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const outcome = await this.service.handleCallback(req.query as Record<string, unknown>, resolveIp(req));
      const params = new URLSearchParams({
        bookingId: outcome.maDatPhong ? String(outcome.maDatPhong) : '',
        status: outcome.redirectStatus,
      });
      res.redirect(302, `${env.FRONTEND_URL.replace(/\/$/, '')}/payment/result?${params.toString()}`);
    } catch {
      res.redirect(302, `${env.FRONTEND_URL.replace(/\/$/, '')}/payment/result?status=unknown`);
    }
  };

  /** Server-to-server notification from VNPAY — the authoritative trigger for confirming a booking. Must always answer {RspCode, Message}, per VNPAY's IPN contract, never throw/500. */
  vnpayIpn = async (req: Request, res: Response): Promise<void> => {
    try {
      const outcome = await this.service.handleCallback(req.query as Record<string, unknown>, resolveIp(req));
      res.json({ RspCode: outcome.rspCode, Message: outcome.message });
    } catch {
      res.json({ RspCode: '99', Message: 'Unknown error' });
    }
  };

  retryRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.retryRefund(id, req.user!.maTaiKhoan, resolveIp(req));
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
