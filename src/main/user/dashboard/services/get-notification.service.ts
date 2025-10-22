import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { QUEUE_EVENTS } from '@project/lib/queue/interface/queue-events';
import { UtilsService } from '@project/lib/utils/utils.service';

@Injectable()
export class GetNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to get notifications', 'Notifications')
  async getAUserNotification(userId: string): Promise<TResponse<any>> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        users: {
          some: { userId },
        },
      },
      include: {
        users: {
          where: { userId },
          select: { read: true, user: { select: { timezone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Format output
    const formatted = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      meta: n.meta,
      read: n.users[0]?.read ?? false, // the current user's read status
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      sent: this.utils.formatLastActive(
        n.createdAt,
        n.users[0].user.timezone ?? 'UTC',
      ),
    }));

    return successResponse(formatted, 'Notifications found successfully');
  }

  @HandleError('Failed to get messages notifications', 'Messages')
  async getAUsersMessagesNotifications(userId: string) {
    const messages = await this.prisma.notification.findMany({
      where: {
        type: {
          mode: 'insensitive',
          contains: QUEUE_EVENTS.MESSAGES,
        },
        users: {
          some: { userId },
        },
      },
      include: {
        users: {
          where: { userId },
          select: { read: true, user: { select: { timezone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const formatted = messages.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      meta: n.meta,
      read: n.users[0]?.read ?? false, // the current user's read status
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      sent: this.utils.formatLastActive(
        n.createdAt,
        n.users[0].user.timezone ?? 'UTC',
      ),
    }));

    return successResponse(formatted, 'Messages found successfully');
  }
}
