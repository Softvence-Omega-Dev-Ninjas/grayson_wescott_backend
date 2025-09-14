import { Global, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { CallService } from './services/call.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { WebrtcService } from './services/webrtc.service';

@Global()
@Module({
  providers: [
    ChatGateway,
    MessageService,
    ConversationService,
    CallService,
    WebrtcService,
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
