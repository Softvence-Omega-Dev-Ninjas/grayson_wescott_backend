import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import * as he from 'he';
import * as nodemailer from 'nodemailer';
import { MailService } from '../mail.service';
import { passwordResetConfirmationTemplate } from '../templates/reset-password-confirm.template';
import { resetPasswordTemplate } from '../templates/reset-password.template';
import { verificationTemplate } from '../templates/verification.template';

@Injectable()
export class AuthMailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    options: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const message = he.encode(options.message || 'Verify your account');
    const safeCode = he.encode(code);
    const baseUrl = this.configService.getOrThrow<string>(
      ENVEnum.FRONTEND_VERIFICATION_URL,
    );
    const link = `${baseUrl}?code=${code}&email=${to}`;

    return this.mailService.sendMail({
      to,
      subject: options.subject || 'Verification Code',
      html: verificationTemplate(safeCode, message, link),
      text: `${message}\nYour verification code: ${code}\nLink: ${link}`,
    });
  }

  async sendResetPasswordLinkEmail(
    to: string,
    resetLink: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const safeMessage = he.encode(
      message ||
        'Click the button below to reset your password. This link will expire in 5 minutes.',
    );

    return this.mailService.sendMail({
      to,
      subject: subject || 'Password Reset Request',
      text: `${safeMessage}\n\nReset your password using this link: ${resetLink}\n\nIf you did not request a password reset, please ignore this email.`,
      html: resetPasswordTemplate(resetLink, safeMessage),
    });
  }

  async sendPasswordResetConfirmationEmail(
    to: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const safeMessage = he.encode(
      message || 'Your password has been successfully reset.',
    );

    return this.mailService.sendMail({
      to,
      subject: subject || 'Password Reset Confirmation',
      text: `${safeMessage}\n\nIf you did not initiate this change, please reset your password immediately.`,
      html: passwordResetConfirmationTemplate(safeMessage),
    });
  }

  async sendSocialProviderLinkEmail(
    to: string,
    link: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Escape dynamic values to prevent injection
    const safeLink = he.encode(link);
    const safeMessage = he.encode(message || 'Click the link below to login.');

    const mailOptions = {
      to,
      subject: subject || 'Social Login Request',
      text: `${safeMessage}\n\nLogin using this link: ${safeLink}\n\nIf you did not request a social login, please ignore this email.`,
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #333; margin-bottom: 15px;">Social Login Request</h3>
      <p style="font-size: 16px; color: #555; margin-bottom: 20px;">${safeMessage}</p>
      <div style="margin: 20px 0;">
        <a href="${safeLink}" style="display:inline-block; background-color:#DC3545; color:#fff; text-decoration:none; padding:12px 20px; border-radius:6px; font-size:16px;">
          Login
        </a>
      </div>
      <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not request a social login, please ignore this email.</p>
    </div>
  </div>
    `,
    };

    return this.mailService.sendMail(mailOptions);
  }
}
