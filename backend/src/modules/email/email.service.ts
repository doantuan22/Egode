import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from '../../common/utils/password-reset-token';

export interface PasswordResetEmail {
  to: string;
  resetUrl: string;
}

export interface EmailDeliveryErrorMeta {
  toMasked: string;
  host: string;
  port: number;
  reason: string;
}

/** Ranh giới gửi mail tách khỏi AuthService */
export interface EmailService {
  sendPasswordResetEmail(message: PasswordResetEmail): Promise<void>;
}

export const isSmtpConfigured = () =>
  // Test tự động không gửi mail thật
  env.NODE_ENV !== 'test' && Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);

export const maskEmail = (email: string): string => {
  const [user = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  const shown = user.slice(0, 2);
  return `${shown}***@${domain}`;
};

const passwordResetText = ({ resetUrl }: PasswordResetEmail) => `Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản Egode.

Mở liên kết sau để đặt lại mật khẩu (có hiệu lực trong ${PASSWORD_RESET_TOKEN_TTL_MINUTES} phút):
${resetUrl}

Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`;

const passwordResetHtml = ({ resetUrl }: PasswordResetEmail) => `<!doctype html>
<html lang="vi">
  <body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
    <h2>Đặt lại mật khẩu Egode</h2>
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Egode của bạn.</p>
    <p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Đặt lại mật khẩu</a></p>
    <p>Nếu nút không bấm được, hãy sao chép liên kết sau vào trình duyệt:<br/>${resetUrl}</p>
    <p>Liên kết có hiệu lực trong ${PASSWORD_RESET_TOKEN_TTL_MINUTES} phút.</p>
    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này hoặc liên hệ hỗ trợ.</p>
  </body>
</html>`;

/** Gửi mail qua SMTP */
export class NodemailerEmailService implements EmailService {
  private readonly transporter: Transporter | null;

  constructor(transporter?: Transporter) {
    this.transporter = transporter ?? (isSmtpConfigured()
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
        })
      : null);
  }

  async verifyConnection(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.transporter) return { ok: false, reason: 'SMTP chưa được cấu hình (thiếu SMTP_HOST/USER/PASSWORD/FROM)' };
    try {
      await this.transporter.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async sendPasswordResetEmail(message: PasswordResetEmail): Promise<void> {
    // Cho phép bỏ SMTP khi chạy local
    if (!this.transporter) {
      const meta: EmailDeliveryErrorMeta = {
        toMasked: maskEmail(message.to),
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        reason: 'SMTP transporter chưa được cấu hình',
      };
      throw Object.assign(new Error(meta.reason), { meta });
    }

    try {
      await this.transporter.sendMail({
        from: { name: 'Egode', address: env.SMTP_FROM },
        to: message.to,
        subject: 'Đặt lại mật khẩu Egode',
        text: passwordResetText(message),
        html: passwordResetHtml(message),
      });
    } catch (error) {
      const meta: EmailDeliveryErrorMeta = {
        toMasked: maskEmail(message.to),
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        reason: error instanceof Error ? error.message : String(error),
      };
      throw Object.assign(new Error(`Không gửi được email đặt lại mật khẩu: ${meta.reason}`), { meta });
    }
  }
}

/** Gửi mail trong bộ nhớ cho test */
export class FakeEmailService implements EmailService {
  readonly messages: PasswordResetEmail[] = [];

  constructor(private readonly failure?: Error) {}

  async sendPasswordResetEmail(message: PasswordResetEmail): Promise<void> {
    if (this.failure) throw this.failure;
    this.messages.push(message);
  }
}
