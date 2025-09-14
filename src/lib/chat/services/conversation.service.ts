import { Injectable } from '@nestjs/common';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Server, Socket } from 'socket.io';
import { ChatEventsEnum } from '../enum/chat-events.enum';
import {
  LoadConversationsPayload,
  LoadSingleConversationPayload,
  NewConversationPayload,
} from '../types/conversation-payloads';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly server: Server,
  ) {}

  /** Initialize a new conversation or return existing */
  async handleNewConversation(client: Socket, payload: NewConversationPayload) {
    const [userId, adminGroupId] = payload.participantIds;

    // Check for existing conversation between admin group and user
    const existing = await this.prisma.privateConversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: payload.participantIds } },
        },
      },
      include: { participants: true, lastMessage: true },
    });

    if (existing) {
      client.emit(ChatEventsEnum.NEW_CONVERSATION, existing);
      return existing;
    }

    // Create new conversation
    const conversation = await this.prisma.privateConversation.create({
      data: {
        participants: {
          create: [
            { userId, type: 'USER' },
            { userId: adminGroupId, type: 'ADMIN_GROUP' },
          ],
        },
      },
      include: { participants: true },
    });

    // Optional initial message
    if (payload.initialMessage) {
      const message = await this.prisma.privateMessage.create({
        data: {
          content: payload.initialMessage,
          conversationId: conversation.id,
          senderId: client.data.userId,
        },
      });

      await this.prisma.privateConversation.update({
        where: { id: conversation.id },
        data: { lastMessageId: message.id },
      });
    }

    // Emit to all participants
    payload.participantIds.forEach((uid) => {
      this.server.to(uid).emit(ChatEventsEnum.NEW_CONVERSATION, conversation);
    });

    return conversation;
  }

  async handleLoadConversations(
    client: Socket,
    payload?: LoadConversationsPayload,
  ) {
    return this.prisma.privateConversation.findMany({
      where: {
        participants: { some: { userId: client.data.userId } },
      },
      orderBy: { updatedAt: 'desc' },
      take: payload?.limit,
    });
  }

  async handleLoadSingleConversation(
    client: Socket,
    payload: LoadSingleConversationPayload,
  ) {
    return this.prisma.privateConversation.findUnique({
      where: { id: payload.conversationId },
      include: { participants: true, messages: true },
    });
  }
}
