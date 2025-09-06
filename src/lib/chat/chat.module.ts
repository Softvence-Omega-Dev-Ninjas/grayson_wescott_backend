import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './services/chat.service';

@Module({
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
