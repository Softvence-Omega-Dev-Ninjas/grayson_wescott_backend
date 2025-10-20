import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  @HandleError('Failed to get all notifications', 'Notifications')
  async getAllNotifications(): Promise<TResponse<any>> {
    const notifications = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        users: {
          select: {
            read: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarUrl: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    // Format output
    const formatted = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      meta: n.meta,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      recipients: n.users.map((u) => ({
        id: u.user.id,
        name: u.user.name,
        email: u.user.email,
        role: u.user.role,
        avatarUrl: u.user.avatarUrl,
        phone: u.user.phone,
        read: u.read,
      })),
    }));

    return successResponse(formatted, 'All notifications fetched successfully');
  }
}
