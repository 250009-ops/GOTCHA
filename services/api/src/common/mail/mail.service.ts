import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { emailVerificationEmail, passwordResetEmail } from './mail.templates';

export type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST')?.trim());
  }

  private getFromAddress(): string {
    return this.config.get<string>('SMTP_FROM')?.trim() || 'GOTCHA <noreply@gotchaa.uz>';
  }

  private getTransporter(): Transporter | null {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return null;

    if (!this.transporter) {
      const port = Number(this.config.get('SMTP_PORT', '465'));
      const secureRaw = this.config.get<string>('SMTP_SECURE', 'true');
      const secure = secureRaw === 'true' || secureRaw === '1' || port === 465;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: this.config.get<string>('SMTP_USER')?.trim(),
          pass: this.config.get<string>('SMTP_PASS')?.trim(),
        },
      });
    }

    return this.transporter;
  }

  async send(options: SendMailOptions): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const replyTo =
      options.replyTo ?? this.config.get<string>('SMTP_REPLY_TO')?.trim() ?? undefined;

    await transporter.sendMail({
      from: this.getFromAddress(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo,
      encoding: 'utf-8',
    });
    return true;
  }

  async sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
    const { subject, text, html } = emailVerificationEmail(name, verifyUrl);
    const sent = await this.send({ to, subject, text, html });

    if (!sent) {
      this.logger.warn(`SMTP not configured — verification link for ${to}: ${verifyUrl}`);
      return;
    }

    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const { subject, text, html } = passwordResetEmail(name, resetUrl);
    const sent = await this.send({ to, subject, text, html });

    if (!sent) {
      this.logger.warn(`SMTP not configured — password reset link for ${to}: ${resetUrl}`);
      return;
    }

    this.logger.log(`Password reset email sent to ${to}`);
  }

  /** Production SMTP health check — does not send mail. */
  async verifyTransporter(): Promise<{ ok: boolean; host?: string; port?: number; error?: string }> {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) {
      return { ok: false, error: 'SMTP_HOST not configured' };
    }
    const port = Number(this.config.get('SMTP_PORT', '465'));
    try {
      const transporter = this.getTransporter();
      if (!transporter) return { ok: false, host, port, error: 'Transporter unavailable' };
      await transporter.verify();
      return { ok: true, host, port };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, host, port, error: message };
    }
  }
}
