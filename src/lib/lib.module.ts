import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { FileModule } from './file/file.module';
import { MailModule } from './mail/mail.module';
import { MulterModule } from './multer/multer.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { SeedModule } from './seed/seed.module';
import { TwilioModule } from './twilio/twilio.module';
import { UtilsModule } from './utils/utils.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    SeedModule,
    PrismaModule,
    MailModule,
    UtilsModule,
    MulterModule,
    QueueModule,
    FileModule,
    ChatModule,
    TwilioModule,
    GatewayModule,
  ],
  exports: [],
  providers: [],
})
export class LibModule {}
