import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@prisma/client';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { AuthMailService } from '@project/lib/mail/services/auth-mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import axios from 'axios';
import {
  SocialLoginCompleteDto,
  SocialLoginDto,
  VerifySocialProviderOtpDto,
} from '../dto/social-login.dto';

@Injectable()
export class AuthSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: AuthMailService,
    private readonly configService: ConfigService,
  ) {}

  @HandleError('Social login failed', 'User')
  async socialLogin(dto: SocialLoginDto): Promise<TResponse<any>> {
    const { provider, accessToken } = dto;
    if (!provider || !accessToken)
      throw new AppError(400, 'Provider and access token are required');

    const profile = await this.getProviderProfile(provider, accessToken);
    const { id: providerId, email, name, avatarUrl } = profile;

    let user = await this.findUserByProviderId(provider, providerId);

    if (!user) {
      if (!email) {
        return successResponse(
          {
            needsEmail: true,
            provider,
            providerId,
            accessToken,
            name: name || '',
            avatarUrl: avatarUrl || '',
          },
          `${provider} did not return an email. Please provide one to continue.`,
        );
      }

      user = await this.createOrLinkUserByEmail(email, {
        provider,
        providerId,
        name,
        avatarUrl,
        isVerified: false,
      });

      if (!user.isVerified) {
        return this.handleUnverifiedUser(user, provider, providerId);
      }
    } else {
      user = await this.updateUserProfile(user, name, avatarUrl);
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
  }

  @HandleError('Social login completion failed', 'User')
  async socialLoginComplete(
    data: SocialLoginCompleteDto,
  ): Promise<TResponse<any>> {
    const { accessToken, email, provider } = data;
    if (!accessToken || !email || !provider)
      throw new AppError(400, 'accessToken, provider and email are required');

    const profile = await this.getProviderProfile(provider, accessToken);
    const providerId = profile.id;

    const user = await this.createOrLinkUserByEmail(email, {
      provider,
      providerId,
      name: profile.name || '',
      avatarUrl: profile.avatarUrl || '',
      isVerified: false,
    });

    if (!user.isVerified) {
      return this.handleUnverifiedUser(user, provider, providerId);
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
  }

  @HandleError('Social OTP verification failed', 'User')
  async verifySocialProviderOtp(
    data: VerifySocialProviderOtpDto,
  ): Promise<TResponse<any>> {
    const { email, otp, provider, providerId } = data;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { authProviders: true },
    });
    if (!user) throw new AppError(404, 'User not found');

    if (
      !user.otp ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date() ||
      user.otp !== otp
    ) {
      throw new AppError(400, 'Invalid or expired OTP');
    }

    const hasProvider = user.authProviders.some(
      (ap) => ap.provider === provider && ap.providerId === providerId,
    );
    if (!hasProvider) {
      await this.prisma.userAuthProvider.create({
        data: { userId: user.id, provider, providerId },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpiresAt: null,
        isVerified: true,
      },
      include: { authProviders: true },
    });

    const token = this.generateUserToken(updatedUser);
    return this.buildSuccessResponse(
      updatedUser,
      token,
      'Account verified successfully',
    );
  }

  // -------------------------
  // Provider profile fetchers
  // -------------------------
  private async getProviderProfile(
    provider: AuthProvider,
    accessToken: string,
  ) {
    switch (provider) {
      case AuthProvider.FACEBOOK:
        return this.getFacebookProfile(accessToken);
      case AuthProvider.INSTAGRAM:
        return this.getInstagramProfile(accessToken);
      case AuthProvider.TWITTER:
        return this.getTwitterProfile(accessToken);
      default:
        throw new AppError(400, 'Unsupported provider');
    }
  }

  private async getFacebookProfile(accessToken: string) {
    const res = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email,picture', access_token: accessToken },
    });
    const data = res.data;
    return {
      id: data.id,
      email: data.email ?? null,
      name: data.name ?? null,
      avatarUrl: data.picture?.data?.url ?? null,
    };
  }

  private async getInstagramProfile(accessToken: string) {
    const res = await axios.get('https://graph.instagram.com/me', {
      params: { fields: 'id,username,account_type', access_token: accessToken },
    });
    const data = res.data;
    return {
      id: data.id,
      email: null, // Instagram does not return email
      name: data.username ?? null,
      avatarUrl: null,
    };
  }

  private async getTwitterProfile(accessToken: string) {
    const res = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { 'user.fields': 'id,name,username,profile_image_url' },
    });
    const d = res.data?.data;
    return {
      id: d?.id,
      email: null, // Twitter v2 does not return email
      name: d?.name ?? d?.username ?? null,
      avatarUrl: d?.profile_image_url ?? null,
    };
  }

  // -------------------------
  // Common DB / helper methods
  // -------------------------
  private async findUserByProviderId(
    provider: AuthProvider,
    providerId: string,
  ) {
    return this.prisma.user.findFirst({
      where: { authProviders: { some: { provider, providerId } } },
      include: { authProviders: true },
    });
  }

  private async createOrLinkUserByEmail(
    email: string,
    options: {
      provider: AuthProvider;
      providerId: string;
      name?: string;
      avatarUrl?: string;
      isVerified: boolean;
    },
  ) {
    email = email.toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { authProviders: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          isVerified: options.isVerified,
          name: options.name || '',
          isLoggedIn: true,
          lastLoginAt: new Date(),
          avatarUrl: options.avatarUrl || '',
          authProviders: {
            create: {
              provider: options.provider,
              providerId: options.providerId,
            },
          },
        },
        include: { authProviders: true },
      });
    } else {
      const hasProvider = user.authProviders.some(
        (ap) =>
          ap.provider === options.provider &&
          ap.providerId === options.providerId,
      );
      if (!hasProvider) {
        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
        const link = `${this.configService.getOrThrow<string>(ENVEnum.FRONTEND_SOCIAL_EMAIL_URL)}?email=${email}&otp=${otp}&provider=${options.provider}&providerId=${options.providerId}`;
        await this.mailService.sendSocialProviderLinkEmail(email, link);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { otp: otp.toString(), otpExpiresAt: expiryTime },
        });
      }
      user = await this.updateUserProfile(
        user,
        options.name,
        options.avatarUrl,
      );
    }
    return user;
  }

  private async handleUnverifiedUser(
    user: any,
    provider: AuthProvider,
    providerId: string,
  ) {
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
    const link = `${this.configService.getOrThrow<string>(ENVEnum.FRONTEND_SOCIAL_EMAIL_URL)}?email=${user.email}&otp=${otp}&provider=${provider}&providerId=${providerId}`;
    await this.mailService.sendSocialProviderLinkEmail(user.email, link);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp: otp.toString(), otpExpiresAt: expiryTime },
    });
    return successResponse(
      { needsVerification: true, email: user.email },
      'Verification email sent. Please verify your email to continue.',
    );
  }

  private async updateUserProfile(
    user: any,
    name?: string,
    avatarUrl?: string,
  ) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        avatarUrl: avatarUrl || user.avatarUrl,
        lastLoginAt: new Date(),
        isLoggedIn: true,
      },
      include: { authProviders: true },
    });
  }

  private generateUserToken(user: any) {
    return this.utils.generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private buildSuccessResponse(user: any, token: string, message?: string) {
    return successResponse(
      {
        user: this.utils.sanitizedResponse(UserResponseDto, user),
        token,
        isVerified: user.isVerified,
      },
      message || 'User logged in successfully',
    );
  }
}
