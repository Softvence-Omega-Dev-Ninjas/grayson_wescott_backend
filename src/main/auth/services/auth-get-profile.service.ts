import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';

@Injectable()
export class AuthGetProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError("Can't get user profile")
  async getProfile(userId: string) {
    const user = await this.findUserBy('id', userId);
    return user;
  }

  private async findUserBy(
    key: 'id' | 'email' | 'phone',
    value: string,
  ): Promise<TResponse<any>> {
    const where: any = {};
    where[key] = value;

    const user = await this.prisma.user.findUnique({
      where,
      include: {
        authProviders: true,
        notifications: true,
        privateConversation1: true,
        privateConversation2: true,
        privateMessage: true,
        privateMessageStatus: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Extract only the main user fields
    const {
      authProviders,
      notifications,
      privateConversation1,
      privateConversation2,
      privateMessage,
      privateMessageStatus,
      ...mainUser
    } = user;

    const sanitizedUser = this.utils.sanitizedResponse(
      UserResponseDto,
      mainUser,
    );

    // Rebuild the full object: sanitized user + full raw relations
    const data = {
      ...sanitizedUser,
      authProviders,
      notifications,
      privateConversation1,
      privateConversation2,
      privateMessage,
      privateMessageStatus,
    };

    return successResponse(data, 'User data fetched successfully');
  }
}
