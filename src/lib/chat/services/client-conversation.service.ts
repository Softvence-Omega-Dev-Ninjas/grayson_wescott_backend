import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Socket } from 'socket.io';
import { ChatGateway } from '../chat.gateway';
import { ChatEventsEnum } from '../enum/chat-events.enum';

@Injectable()
export class ClientConversationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @HandleError('Failed to load conversation of a client', 'ConversationService')
  async handleLoadClientConversation(
    client: Socket,
    payload: PaginationDto,
  ): Promise<TResponse<any>> {
    const limit = payload?.limit ?? 10;
    const page = payload?.page && +payload.page > 0 ? +payload.page : 1;

    // RAW Conversations
    const conversations = await this.prisma.privateConversation.findFirst({
      where: { participants: { some: { userId: client.data.userId } } },
      include: {
        lastMessage: true,
        messages: {
          include: { sender: true, file: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: (page - 1) * limit,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formattedMessages = conversations?.messages.map((m) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt,
      isSendByClient: m.sender?.id === client.data.userId,
      file: {
        id: m.file?.id,
        url: m.file?.url,
        type: m.file?.fileType,
        mimeType: m.file?.mimeType,
      },
      sender: {
        id: m.sender?.id,
        name: m.sender?.name,
        avatarUrl: m.sender?.avatarUrl,
        role: m.sender?.role,
        email: m.sender?.email,
      },
    }));

    // Emit
    this.chatGateway.server.to(client.data.userId).emit(
      ChatEventsEnum.CLIENT_CONVERSATION,
      successPaginatedResponse(
        formattedMessages ?? [],
        {
          page,
          limit,
          total: conversations?._count?.messages ?? 0,
        },
        'Conversations loaded successfully',
      ),
    );

    // Response
    return successPaginatedResponse(
      formattedMessages ?? [],
      {
        page,
        limit,
        total: conversations?._count?.messages ?? 0,
      },
      'Conversations loaded successfully',
    );
  }
}
