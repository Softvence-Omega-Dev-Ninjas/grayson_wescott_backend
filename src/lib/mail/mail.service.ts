import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import * as he from 'he';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const user = this.configService.getOrThrow<string>(ENVEnum.MAIL_USER);
    const pass = this.configService.getOrThrow<string>(ENVEnum.MAIL_PASS);

    this.fromEmail = user;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  public async sendMail({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<nodemailer.SentMessageInfo> {
    return this.transporter.sendMail({
      from: `"No Reply" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text,
    });
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

  async sendSocialProviderLinkEmail(
    to: string,
    link: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    // Escape dynamic values to prevent injection
    const safeLink = he.encode(link);
    const safeMessage = he.encode(message || 'Click the link below to login.');

    const mailOptions = {
      from: `"No Reply" <${this.configService.getOrThrow<string>(ENVEnum.MAIL_USER)}>`,
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

    return this.transporter.sendMail(mailOptions);
  }
}
