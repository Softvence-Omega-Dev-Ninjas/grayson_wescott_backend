import { Global, Module } from '@nestjs/common';
import { ChatGateway } from '../gateway/chat.gateway';
import { CallService } from './services/call.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { WebRTCService } from './services/webrtc.service';

@Global()
@Module({
  providers: [
    ChatGateway,
    MessageService,
    ConversationService,
    CallService,
    WebRTCService,
  ],
  exports: [],
})
export class ChatModule {}
