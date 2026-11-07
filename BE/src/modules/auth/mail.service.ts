import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (user && pass) {
      if (host === 'smtp.gmail.com' || user.endsWith('@gmail.com')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        this.logger.log(`SMTP Mailer initialized using Gmail service for ${user}`);
      } else if (host) {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        this.logger.log(`SMTP Mailer initialized with host: ${host}:${port}`);
      }
    } else {
      this.logger.warn(
        'SMTP credentials not fully configured (SMTP_USER, SMTP_PASS). Emails will be logged to console in dev mode.',
      );
    }
  }

  async sendOtpEmail(to: string, otp: string, recipientName?: string): Promise<boolean> {
    const subject = `[MKT Hub] Mã xác thực đặt lại mật khẩu của bạn: ${otp}`;
    const name = recipientName || 'Quý khách';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fb; margin: 0; padding: 20px; color: #333; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #e9ecef; }
          .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: #ffffff; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .content { padding: 32px 28px; text-align: center; }
          .greeting { font-size: 16px; margin-bottom: 16px; color: #1e293b; text-align: left; }
          .description { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; text-align: left; }
          .otp-box { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 8px; padding: 18px 24px; display: inline-block; margin: 10px 0 24px; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0369a1; font-family: 'Courier New', Courier, monospace; margin: 0; }
          .expiry-note { font-size: 13px; color: #dc2626; margin-top: 6px; font-weight: 500; }
          .warning { font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: left; line-height: 1.5; }
          .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MKT Hub Authentication</h1>
          </div>
          <div class="content">
            <div class="greeting">Xin chào <strong>${name}</strong>,</div>
            <div class="description">
              Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${to}</strong> trên hệ thống MKT Hub. 
              Vui lòng sử dụng mã xác thực (OTP) bên dưới để hoàn tất:
            </div>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="expiry-note">⏱ Mã có hiệu lực trong vòng 10 phút</div>
            </div>
            <div class="warning">
              ⚠️ <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ quản trị viên ngay lập tức.
            </div>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} MKT Hub Management Platform. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    // 1. Prioritize Google Mail Webhook (Sends directly from your Gmail to ANY email address via HTTPS, 100% inbox delivery)
    const googleWebhookUrl = process.env.GOOGLE_MAIL_WEBHOOK_URL;
    if (googleWebhookUrl) {
      try {
        const response = await fetch(googleWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject,
            html,
          }),
        });

        if (response.ok) {
          this.logger.log(`OTP email sent successfully via Google Mail Webhook to ${to}`);
          return true;
        }
      } catch (error) {
        this.logger.error(`Failed to send via Google Mail Webhook:`, error);
      }
    }

    // 2. Prioritize Brevo HTTP API (allows sending to any recipient without domain verification, port 443)
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (brevoApiKey) {
      try {
        const senderEmail = process.env.BREVO_SENDER || process.env.SMTP_USER || 'aybizi1235@gmail.com';
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey.trim(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'MKT Hub', email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
          }),
        });

        const data: any = await response.json();
        if (response.ok) {
          this.logger.log(`OTP email sent successfully via Brevo to ${to} (MessageId: ${data.messageId})`);
          return true;
        } else {
          this.logger.error(`Brevo API error: ${JSON.stringify(data)}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send via Brevo API:`, error);
      }
    }

    // 2. Prioritize Resend HTTP API (works on Render)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      try {
        const from = process.env.RESEND_FROM || 'MKT Hub <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject,
            html,
          }),
        });

        const data: any = await response.json();
        if (response.ok) {
          this.logger.log(`OTP email sent successfully via Resend to ${to} (ID: ${data.id})`);
          return true;
        } else {
          this.logger.error(`Resend API error: ${JSON.stringify(data)}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send via Resend API:`, error);
      }
    }

    // 2. Fallback to Nodemailer SMTP
    if (this.transporter) {
      try {
        const from = process.env.SMTP_FROM || `"MKT Hub" <${process.env.SMTP_USER}>`;
        const sendPromise = this.transporter.sendMail({
          from,
          to,
          subject,
          html,
        });

        await Promise.race([
          sendPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP connection timeout after 8s')), 8000),
          ),
        ]);

        this.logger.log(`OTP email sent successfully via SMTP to ${to}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send OTP email via SMTP to ${to}:`, error);
      }
    }

    // 3. Fallback to Dev Console log
    this.logger.log(`[DEV MODE - OTP EMAIL] To: ${to} | Code: ${otp}`);
    return true;
  }
}
