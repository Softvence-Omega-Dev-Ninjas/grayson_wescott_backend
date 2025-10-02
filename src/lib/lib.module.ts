import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { SeedModule } from './seed/seed.module';
import { TwilioModule } from './twilio/twilio.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [
    SeedModule,
    PrismaModule,
    MailModule,
    UtilsModule,
    QueueModule,
    ChatModule,
    TwilioModule,
  ],
  exports: [],
  providers: [],
})
export class LibModule {}
