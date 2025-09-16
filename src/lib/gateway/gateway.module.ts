import { Global, Module } from '@nestjs/common';
import { CallService } from '../chat/services/call.service';
import { ConversationService } from '../chat/services/conversation.service';
import { MessageService } from '../chat/services/message.service';
import { WebRTCService } from '../chat/services/webrtc.service';
import { AppGateway } from './app.gateway';
import { ChatGateway } from './chat.gateway';

@Global()
@Module({
  providers: [
    AppGateway,
    ChatGateway,
    MessageService,
    ConversationService,
    CallService,
    WebRTCService,
  ],
  exports: [AppGateway],
})
export class GatewayModule {}
