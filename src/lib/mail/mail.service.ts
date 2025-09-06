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

  async sendLoginCodeEmail(
    email: string,
    code: string,
  ): Promise<nodemailer.SentMessageInfo> {
    const mailOptions = {
      from: `"No Reply" <${this.configService.get<string>(ENVEnum.MAIL_USER)}>`,
      to: email,
      subject: 'Login Code',
      html: `
        <h3>Welcome!</h3>
        <p>Please login by using the code below:</p>
        <p>Your login code is ${code}</p>
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
