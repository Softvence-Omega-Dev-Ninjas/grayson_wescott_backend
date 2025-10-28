import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { EventsEnum } from '@project/common/enum/events.enum';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { LoadConversationsDto } from '../dto/conversation.dto';

@Injectable()
export class ConversationService {
  private logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to load conversations', 'ConversationService')
  async handleLoadConversationsByAdmin(
    client: Socket,
    payload?: LoadConversationsDto,
  ): Promise<TPaginatedResponse<any>> {
    // Pagination
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // RAW Conversations
    const conversations = await this.prisma.privateConversation.findMany({
      include: {
        lastMessage: true,
        participants: {
          where: { type: 'USER' },
          include: { user: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const outputData = conversations.map((conversation) => ({
      conversationId: conversation.id,
      lastMessage: conversation.lastMessage,
      profile: {
        id: conversation.participants[0].user?.id,
        name: conversation.participants[0].user?.name,
        avatarUrl: conversation.participants[0].user?.avatarUrl,
        role: conversation.participants[0].user?.role,
        email: conversation.participants[0].user?.email,
        isOnline: this.isClientOnline(
          conversation.participants[0].user?.id ?? '',
        ),
      },
    }));

    // Debug log so you can confirm this code runs
    this.logger.debug(
      `handleLoadConversationsByAdmin: sending ${outputData.length} items to socket ${client.id}`,
    );

    // Emit directly to the requesting socket (most reliable)
    try {
      client.emit(
        EventsEnum.CONVERSATION_LIST,
        successPaginatedResponse(
          outputData,
          { limit, page, total: conversations.length },
          'Conversations loaded successfully',
        ),
      );
    } catch (err) {
      this.logger.error(
        `Failed to emit conversation list to ${client.id}: ${err?.message}`,
      );
    }

    // Response
    return successPaginatedResponse(
      outputData,
      { limit, page, total: conversations.length },
      'Conversations loaded successfully',
    );
  }

  private isClientOnline(clientId: string): boolean {
    const sockets = this.chatGateway.server.sockets.adapter.rooms.get(clientId);
    return !!sockets?.size;
  }
}
