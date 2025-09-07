import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import axios from 'axios';
import { FacebookLoginDto } from '../dto/facebook-login.dto';

@Injectable()
export class AuthFacebookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Facebook login failed', 'User')
  async facebookLogin(dto: FacebookLoginDto): Promise<TResponse<any>> {
    const { accessToken } = dto;

    if (!accessToken) {
      throw new AppError(400, 'Facebook access token is required');
    }

    const fbRes = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`,
    );

    const { id, email, name, picture } = fbRes.data;

    if (!email) {
      throw new AppError(400, 'Facebook did not return an email address');
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { authProviders: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          isVerified: true,
          name: name || '',
          avatarUrl: picture?.data?.url || '',
          authProviders: {
            create: { provider: AuthProvider.FACEBOOK, providerId: id },
          },
        },
        include: { authProviders: true },
      });
    } else {
      const hasFacebookProvider = user.authProviders.some(
        (ap) => ap.provider === AuthProvider.FACEBOOK && ap.providerId === id,
      );

      if (!hasFacebookProvider) {
        await this.prisma.userAuthProvider.create({
          data: {
            userId: user.id,
            provider: AuthProvider.FACEBOOK,
            providerId: id,
          },
        });
      } else {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: name || user.name,
            avatarUrl: picture?.data?.url || user.avatarUrl,
          },
          include: { authProviders: true },
        });
      }
    }

    const token = this.utils.generateToken({
      sub: user.id,
      email: user.email,
      roles: user.role,
    });

    return successResponse(
      {
        user: this.utils.sanitizedResponse(UserResponseDto, user),
        token,
      },
      'User logged in successfully',
    );
  }
}
