import { Global, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './services/chat.service';

@Global()
@Module({
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
