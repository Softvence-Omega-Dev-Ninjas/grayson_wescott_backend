import { Module } from '@nestjs/common';
import { FileService } from '@project/lib/file/file.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  controllers: [ChatController],
  providers: [ChatService, FileService, ChatGateway],
})
export class PrivateChatModule {}
