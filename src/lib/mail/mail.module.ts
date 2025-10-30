import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { AuthMailService } from './services/auth-mail.service';
import { ContactMailService } from './services/contact-mail.service';
import { CronMailService } from './services/cron-mail.service';
import { WeeklyReviewMailService } from './services/weekly-review.service';

@Global()
@Module({
  providers: [
    MailService,
    AuthMailService,
    CronMailService,
    ContactMailService,
    WeeklyReviewMailService,
  ],
  exports: [
    AuthMailService,
    CronMailService,
    ContactMailService,
    WeeklyReviewMailService,
  ],
})
export class MailModule {}
