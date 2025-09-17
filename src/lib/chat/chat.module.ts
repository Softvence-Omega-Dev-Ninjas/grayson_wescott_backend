import { Global, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { CallService } from './services/call.service';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { WebRTCService } from './services/webrtc.service';
import { SingleConversationService } from './services/single-conversation.service';
import { ClientConversationService } from './services/client-conversation.service';

@Global()
@Module({
  providers: [
    ChatGateway,
    MessageService,
    ConversationService,
    CallService,
    WebRTCService,
    SingleConversationService,
    ClientConversationService,
  ],
  exports: [ChatGateway],
})
export class ChatModule {}
