import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './services/contact.service';
import { CreateContactService } from './services/create-contact.service';

@Module({
  controllers: [ContactController],
  providers: [ContactService, CreateContactService],
})
export class ContactModule {}
