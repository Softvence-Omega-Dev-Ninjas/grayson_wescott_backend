import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './services/contact.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
