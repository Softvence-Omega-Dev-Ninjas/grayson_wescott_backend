import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',

      auth: {
        user: this.configService.get<string>(ENVEnum.MAIL_USER),
        pass: this.configService.get<string>(ENVEnum.MAIL_PASS),
      },
    });
  }

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    { subject, message }: { subject?: string; message?: string } = {},
  ): Promise<nodemailer.SentMessageInfo> {
    const mailOptions = {
      from: `"No Reply" <${this.configService.get<string>(ENVEnum.MAIL_USER)}>`,
      to,
      subject: subject || 'Verification Code',
      html: `
  <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
    <div style="max-width: 500px; margin: auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="color: #333;">Welcome!</h3>
      <p style="font-size: 16px; color: #555;">${message || 'Verify your account'}:</p>
      <p style="font-size: 20px; font-weight: bold; color: #000; background-color: #f0f0f0; display: inline-block; padding: 10px 15px; border-radius: 4px;">
        ${code}
      </p>
      <p style="font-size: 14px; color: #888; margin-top: 20px;">If you did not request this code, please ignore this email.</p>
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
      from: `"No Reply" <${this.configService.get<string>(ENVEnum.MAIL_USER)}>`,
      to: email,
      subject,
      html: message,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
