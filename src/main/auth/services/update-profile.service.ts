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
import { UpdateUserPreferencesDto } from '../dto/update-user-preferences.dto';

@Injectable()
export class UpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to update user preferences', 'User')
  async manageUserPreferences(
    userId: string,
    preferences: UpdateUserPreferencesDto,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        timezone: preferences.timezone || user.timezone,
        allowDirectMessages:
          preferences.allowDirectMessages ?? user.allowDirectMessages,
        allowEmailMessages:
          preferences.allowEmailMessages ?? user.allowEmailMessages,
      },
    });

    return successResponse(
      this.utils.sanitizedResponse(UserResponseDto, updatedUser),
      'User preferences updated successfully',
    );
  }
}
