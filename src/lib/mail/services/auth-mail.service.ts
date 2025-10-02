import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import * as he from 'he';
import { verificationTemplate } from '../templates/verification.template';
import { MailService } from '../mail.service';

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
  ) {
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
}
