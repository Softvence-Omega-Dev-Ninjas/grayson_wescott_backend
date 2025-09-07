import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import * as he from 'he';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',

      auth: {
        user: this.configService.getOrThrow<string>(ENVEnum.MAIL_USER),
        pass: this.configService.getOrThrow<string>(ENVEnum.MAIL_PASS),
      },
    });
  }

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Escape dynamic values to prevent injection
    const safeCode = he.encode(code);
    const safeMessage = he.encode(message || 'Verify your account');

    // Build verification link (without exposing email in URL)
    const baseUrl = this.configService.getOrThrow<string>(
      ENVEnum.FRONTEND_VERIFICATION_URL,
    );
    const link = `${baseUrl}?code=${code}&email=${to}`;

    const mailOptions = {
      from: `"No Reply" <${this.configService.getOrThrow<string>(ENVEnum.MAIL_USER)}>`,
      to,
      subject: subject || 'Verification Code',
      text: `${safeMessage}\n\nYour verification code is: ${code}\nOr click this link to verify: ${link}\n\nIf you did not request this, please ignore this email.`,
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #333; margin-bottom: 15px;">Welcome!</h3>
      <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${safeMessage}</p>
      <p style="font-size: 20px; font-weight: bold; color: #000; background-color: #f0f0f0; display: inline-block; padding: 10px 15px; border-radius: 4px; letter-spacing: 2px;">
        ${safeCode}
      </p>
      <div style="margin: 20px 0;">
        <a href="${link}" style="display:inline-block; background-color:#007BFF; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-size:16px;">
          Verify Account
        </a>
      </div>
      <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not request this code, please ignore this email.</p>
    </div>
  </div>
    `,
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendResetPasswordLinkEmail(
    to: string,
    resetLink: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Escape dynamic values to prevent injection
    const safeResetLink = he.encode(resetLink);
    const safeMessage = he.encode(
      message ||
        'Click the link below to reset your password. This link will expire in 5 minutes.',
    );

    const mailOptions = {
      from: `"No Reply" <${this.configService.getOrThrow<string>(ENVEnum.MAIL_USER)}>`,
      to,
      subject: subject || 'Password Reset Request',
      text: `${safeMessage}\n\nReset your password using this link: ${resetLink}\n\nIf you did not request a password reset, please ignore this email.`,
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #333; margin-bottom: 15px;">Password Reset Request</h3>
      <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${safeMessage}</p>
      <div style="margin: 20px 0;">
        <a href="${safeResetLink}" style="display:inline-block; background-color:#DC3545; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-size:16px;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not request a password reset, please ignore this email.</p>
    </div>
  </div>
    `,
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetConfirmationEmail(
    to: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Escape dynamic values to prevent injection
    const safeMessage = he.encode(
      message || 'Your password has been successfully reset.',
    );

    const mailOptions = {
      from: `"No Reply" <${this.configService.getOrThrow<string>(ENVEnum.MAIL_USER)}>`,
      to,
      subject: subject || 'Password Reset Confirmation',
      text: `${safeMessage}\n\nIf you did not initiate this change, please reset your password immediately.`,
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #333; margin-bottom: 15px;">Password Reset Successful</h3>
      <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${safeMessage}</p>
      <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not initiate this change, please reset your password immediately.</p>
    </div>
  </div>
    `,
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendEmail(
    email: string,
    subject: string,
    message: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const mailOptions = {
      from: `"No Reply" <${this.configService.getOrThrow<string>(ENVEnum.MAIL_USER)}>`,
      to: email,
      subject,
      html: message,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
