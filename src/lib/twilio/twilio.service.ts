import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private readonly twilio: Twilio;
  private readonly fromPhone: string;
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly config: ConfigService) {
    this.twilio = new Twilio(
      this.config.getOrThrow(ENVEnum.TWILIO_ACCOUNT_SID),
      this.config.getOrThrow(ENVEnum.TWILIO_AUTH_TOKEN),
    );
    this.fromPhone = this.config.getOrThrow(ENVEnum.TWILIO_PHONE_NUMBER);
  }

  async sendTFACode(phone: string, code: string): Promise<void> {
    try {
      await this.twilio.messages.create({
        body: `Your verification code is ${code}`,
        from: this.fromPhone,
        to: phone,
      });
      this.logger.log(`SMS sent to ${phone}`);
    } catch (error) {
      throw new AppError(500, error.message || error || 'Error sending SMS');
    }
  }
}
