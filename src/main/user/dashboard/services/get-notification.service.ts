import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class GetNotificationService {
  constructor(private readonly prisma: PrismaService) {}

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
          select: { read: true },
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
    }));

    return successResponse(formatted, 'Notifications found successfully');
  }
}
