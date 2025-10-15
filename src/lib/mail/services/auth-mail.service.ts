import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { SocialLoginEmailPayload } from '@project/common/jwt/jwt.interface';
import * as he from 'he';
import * as nodemailer from 'nodemailer';
import { MailService } from '../mail.service';
import { passwordResetConfirmationTemplate } from '../templates/reset-password-confirm.template';
import { resetPasswordTemplate } from '../templates/reset-password.template';
import { socialLoginWithOtpTemplate } from '../templates/social-media.template';
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
    payload: SocialLoginEmailPayload,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Build the link here
    const frontendUrl = this.configService.getOrThrow<string>(
      ENVEnum.FRONTEND_SOCIAL_EMAIL_URL,
    );

    const link = `${frontendUrl}?email=${encodeURIComponent(payload.email)}&otp=${encodeURIComponent(payload.otp)}&provider=${encodeURIComponent(payload.provider)}&providerId=${encodeURIComponent(payload.providerId)}`;

    const safeLink = he.encode(link);
    const safeOtp = he.encode(payload.otp);
    const safeMessage = he.encode(
      message || 'Click the link below or use the OTP to login.',
    );

    return this.mailService.sendMail({
      to: payload.email,
      subject: subject || 'Social Login Request',
      text: `${safeMessage}\n\nOTP: ${safeOtp}\nLogin using this link: ${safeLink}\n\nIf you did not request a social login, please ignore this email.`,
      html: socialLoginWithOtpTemplate(
        safeLink,
        safeOtp,
        safeMessage,
        payload.provider,
      ),
    });
  }
}
