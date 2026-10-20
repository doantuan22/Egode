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

  /** Thanh toán giả lập, xác nhận ngay không chuyển hướng */
  paySimulated = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.paySimulated(id, req.user!.maTaiKhoan);
      sendSuccess(res, result, 'Thanh toán thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  /** Cho client biết chế độ thanh toán đang bật */
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

  /** Trình duyệt quay lại sau khi trả tiền, chỉ để hiển thị */
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

  /** Thông báo IPN của VNPAY, bắt buộc trả {RspCode, Message} */
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
