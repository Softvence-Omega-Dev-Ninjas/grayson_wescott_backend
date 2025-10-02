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
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import axios from 'axios';
import {
  FacebookLoginCompleteDto,
  FacebookLoginDto,
} from '../dto/facebook-login.dto';
import { VerifySocialProviderOtpDto } from '../dto/provider.dto';

@Injectable()
export class AuthFacebookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @HandleError('Facebook login failed', 'User')
  async facebookLogin(dto: FacebookLoginDto): Promise<TResponse<any>> {
    const { accessToken } = dto;
    if (!accessToken)
      throw new AppError(400, 'Facebook access token is required');

    const fbProfile = await this.getFacebookProfile(accessToken, [
      'id',
      'name',
      'email',
      'picture',
    ]);
    const { id: providerId, email, name, picture } = fbProfile;

    let user = await this.findUserByProviderId(providerId);
    if (!user) {
      if (!email) {
        return successResponse(
          {
            needsEmail: true,
            provider: AuthProvider.FACEBOOK,
            providerId,
            accessToken,
            name: name || '',
            avatarUrl: picture?.data?.url || '',
          },
          'Facebook did not return an email. Please provide one to continue.',
        );
      }

      user = await this.createOrLinkUserByEmail(email, {
        provider: AuthProvider.FACEBOOK,
        providerId,
        name,
        avatarUrl: picture?.data?.url || '',
        isVerified: false, // New accounts are unverified by default
      });

      if (!user.isVerified) {
        return this.handleUnverifiedUser(
          user,
          AuthProvider.FACEBOOK,
          providerId,
        );
      }
    } else {
      user = await this.updateUserProfile(user, name, picture?.data?.url || '');
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
  }

  @HandleError('Facebook login completion failed', 'User')
  async facebookLoginComplete(
    data: FacebookLoginCompleteDto,
  ): Promise<TResponse<any>> {
    const { accessToken, email } = data;
    if (!accessToken || !email) {
      throw new AppError(
        400,
        'ProviderId, accessToken, and email are required',
      );
    }

    const fbProfile = await this.getFacebookProfile(accessToken, [
      'id',
      'name',
      'picture',
      'email',
    ]);

    const user = await this.createOrLinkUserByEmail(email, {
      provider: AuthProvider.FACEBOOK,
      providerId: fbProfile.id,
      name: fbProfile.name || '',
      avatarUrl: fbProfile.picture?.data?.url || '',
      isVerified: false,
    });

    if (!user.isVerified) {
      return this.handleUnverifiedUser(
        user,
        AuthProvider.FACEBOOK,
        fbProfile.id,
      );
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
  }

  @HandleError('Facebook OTP verification failed', 'User')
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

    // Update verification status
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

  private async getFacebookProfile(accessToken: string, fields: string[]) {
    const res = await axios.get(
      `https://graph.facebook.com/me?fields=${fields.join(',')}&access_token=${accessToken}`,
    );
    return res.data;
  }

  private async findUserByProviderId(providerId: string) {
    return this.prisma.user.findFirst({
      where: {
        authProviders: {
          some: { provider: AuthProvider.FACEBOOK, providerId },
        },
      },
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
        const otpWithExpiry = this.utils.generateOtpAndExpiry();
        const { otp, expiryTime } = otpWithExpiry;

        const link = `${this.configService.getOrThrow<string>(
          ENVEnum.FRONTEND_SOCIAL_EMAIL_URL,
        )}?email=${email}&otp=${otp}&provider=${options.provider}&providerId=${options.providerId}`;

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
    const otpWithExpiry = this.utils.generateOtpAndExpiry();
    const { otp, expiryTime } = otpWithExpiry;

    const link = `${this.configService.getOrThrow<string>(
      ENVEnum.FRONTEND_SOCIAL_EMAIL_URL,
    )}?email=${user.email}&otp=${otp}&provider=${provider}&providerId=${providerId}`;

    await this.mailService.sendSocialProviderLinkEmail(user.email, link);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp: otp.toString(), otpExpiresAt: expiryTime },
    });

    return successResponse(
      {
        needsVerification: true,
        email: user.email,
      },
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
