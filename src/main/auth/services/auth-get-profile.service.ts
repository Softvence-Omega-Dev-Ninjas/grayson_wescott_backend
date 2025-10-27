import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
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

    const user = await this.prisma.user.findUniqueOrThrow({ where });

    const sanitizedUser = this.utils.sanitizedResponse(UserResponseDto, user);

    return successResponse(sanitizedUser, 'User data fetched successfully');
  }
}
