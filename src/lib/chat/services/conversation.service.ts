import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { EventsEnum } from '../../../common/enum/events.enum';
import { ChatGateway } from '../chat.gateway';
import { LoadConversationsDto } from '../dto/conversation.dto';

@Injectable()
export class ConversationService {
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
      take: payload?.limit ?? 10,
      skip: (page - 1) * limit,
    });

    // Output
    const outputData = conversations.map((conversation) => {
      return {
        conversationId: conversation.id,
        lastMessage: conversation.lastMessage,
        profile: {
          id: conversation.participants[0].user?.id,
          name: conversation.participants[0].user?.name,
          avatarUrl: conversation.participants[0].user?.avatarUrl,
          role: conversation.participants[0].user?.role,
          email: conversation.participants[0].user?.email,
        },
      };
    });

    // Emit
    this.chatGateway.server.to(client.data.userId).emit(
      EventsEnum.CONVERSATION_LIST,
      successPaginatedResponse(
        outputData,
        {
          limit,
          page,
          total: conversations.length,
        },
        'Conversations loaded successfully',
      ),
    );

    // Response
    return successPaginatedResponse(
      outputData,
      {
        limit,
        page,
        total: conversations.length,
      },
      'Conversations loaded successfully',
    );
  }
}
