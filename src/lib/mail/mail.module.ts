import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { AuthMailService } from './services/auth-mail.service';
import { ContactMailService } from './services/contact-mail.service';
import { CronMailService } from './services/cron-mail.service';

@Global()
@Module({
  providers: [
    MailService,
    AuthMailService,
    CronMailService,
    ContactMailService,
  ],
  exports: [AuthMailService, CronMailService, ContactMailService],
})
export class MailModule {}
