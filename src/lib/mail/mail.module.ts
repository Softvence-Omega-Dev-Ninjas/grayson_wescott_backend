import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { AuthMailService } from './services/auth-mail.service';
import { CronMailService } from './services/cron-mail.service';

@Global()
@Module({
  providers: [MailService, AuthMailService, CronMailService],
  exports: [AuthMailService, CronMailService],
})
export class MailModule {}
