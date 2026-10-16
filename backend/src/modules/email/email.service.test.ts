import { describe, expect, it, vi } from 'vitest';
import { NodemailerEmailService, FakeEmailService, maskEmail, isSmtpConfigured } from './email.service';

describe('email helpers', () => {
  it('masks the local part of an email address', () => {
    expect(maskEmail('customer@example.com')).toBe('cu***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('rejects poorly formatted SMTP passwords and reports the reason', async () => {
    const failingTransport = {
      sendMail: vi.fn().mockRejectedValue(new Error('Invalid login: 535-5.7.8 Username and Password not accepted')),
    };
    const service = new NodemailerEmailService(failingTransport as never);

    await expect(service.sendPasswordResetEmail({ to: 'user@example.com', resetUrl: 'http://x/reset-password?token=t' }))
      .rejects.toMatchObject({ meta: { toMasked: 'us***@example.com' } });
  });

  it('never touches the network in test env even with SMTP configured', () => {
    expect(isSmtpConfigured()).toBe(false);
    expect(new FakeEmailService().messages).toHaveLength(0);
  });
});
