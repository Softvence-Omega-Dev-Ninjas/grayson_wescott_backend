import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleLoginDto } from '../dto/google-login.dto';

@Injectable()
export class AuthGoogleService {
  private googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>(ENVEnum.OAUTH_CLIENT_ID),
    );
  }

  @HandleError('Google login failed', 'User')
  async googleLogin(dto: GoogleLoginDto): Promise<TResponse<any>> {
    const { idToken } = dto;

    if (!idToken) {
      throw new AppError(400, 'Google ID token is required');
    }

    const payload = await this.verifyGoogleIdToken(idToken);

    // * Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: payload.email },
      include: { authProviders: true },
    });

    if (!user) {
      // * Create new user
      user = await this.prisma.user.create({
        data: {
          email: payload.email as string,
          isVerified: true,
          name: payload.name || '',
          avatarUrl: payload.picture || '',
          authProviders: {
            create: { provider: 'GOOGLE', providerId: payload.sub },
          },
        },
        include: { authProviders: true },
      });
    } else {
      // * Link Google auth provider if not linked
      const hasGoogleProvider = user.authProviders.some(
        (ap) => ap.provider === 'GOOGLE' && ap.providerId === payload.sub,
      );

      if (!hasGoogleProvider) {
        await this.prisma.userAuthProvider.create({
          data: {
            userId: user.id,
            provider: 'GOOGLE',
            providerId: payload.sub,
          },
        });
      } else {
        // * Update user info
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: payload.name || user.name,
            avatarUrl: payload.picture || user.avatarUrl,
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

  private async verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.get<string>(ENVEnum.OAUTH_CLIENT_ID),
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new AppError(400, 'Invalid Google token');
    }

    const { sub, email } = payload;

    if (!email || !sub) {
      throw new AppError(
        400,
        'Google token does not contain required user information',
      );
    }

    return payload;
  }
}
