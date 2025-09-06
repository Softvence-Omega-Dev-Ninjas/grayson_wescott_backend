import { Module } from '@nestjs/common';
import { PrivateChatController } from './private-chat.controller';
import { PrivateChatService } from './private-chat.service';
import { PrivateChatGateway } from './privateChatGateway/privateChatGateway';
import { FileService } from '@project/lib/file/file.service';

@Module({
  controllers: [PrivateChatController],
  providers: [PrivateChatService, FileService, PrivateChatGateway],
})
export class PrivateChatModule {}
