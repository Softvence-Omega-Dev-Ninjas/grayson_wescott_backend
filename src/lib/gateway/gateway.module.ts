import { Global, Module } from '@nestjs/common';
import { CallService } from '../chat/services/call.service';
import { ConversationService } from '../chat/services/conversation.service';
import { MessageService } from '../chat/services/message.service';
import { WebRTCService } from '../chat/services/webrtc.service';
import { AppGateway } from './app.gateway';

@Global()
@Module({
  providers: [
    AppGateway,
    MessageService,
    ConversationService,
    CallService,
    WebRTCService,
  ],
  exports: [AppGateway],
})
export class GatewayModule {}
