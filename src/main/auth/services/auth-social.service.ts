import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@prisma/client';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { SocialLoginEmailPayload } from '@project/common/jwt/jwt.interface';
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
  ) {}

  @HandleError('Social login failed', 'User')
  async socialLogin(dto: SocialLoginDto): Promise<TResponse<any>> {
    const { provider, accessToken } = dto;
    if (!provider || !accessToken)
      throw new AppError(400, 'Provider and access token are required');

    const profile = await this.getProviderProfile(provider, accessToken);
    const { id: providerId, email, name, avatarUrl } = profile;

    // try find user by providerId first
    let user = await this.findUserByProviderId(provider, providerId);

    if (!user) {
      // no user with this provider id
      if (!email) {
        // provider didn't return email -> caller must ask user for email
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

      // provider returned email -> attempt to find existing user by email
      const normalizedEmail = email.toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { authProviders: true },
      });

      if (!existing) {
        // no existing user -> create a new user and attach provider
        user = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            isVerified: true, // email from provider considered verified
            name: name || '',
            isLoggedIn: true,
            lastLoginAt: new Date(),
            avatarUrl: avatarUrl || '',
            authProviders: {
              create: {
                provider,
                providerId,
              },
            },
          },
          include: { authProviders: true },
        });
      } else {
        // existing user found by email
        const hasProvider = existing.authProviders.some(
          (ap) => ap.provider === provider && ap.providerId === providerId,
        );

        if (!hasProvider) {
          // not linked yet -> send OTP so user can verify+link provider
          const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
          const payload: SocialLoginEmailPayload = {
            email: normalizedEmail,
            otp: otp.toString(),
            provider,
            providerId,
          };

          await this.mailService.sendSocialProviderLinkEmail(payload);
          await this.prisma.user.update({
            where: { id: existing.id },
            data: { otp: otp.toString(), otpExpiresAt: expiryTime },
          });
        }

        // update profile fields (last login / avatar / name...)
        user = await this.updateUserProfile(existing, name, avatarUrl);
      }
    } else {
      // user found by providerId -> just update profile and treat as login
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

    const normalizedEmail = email.toLowerCase();

    // Try to find user by email
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authProviders: true },
    });

    if (!user) {
      // create user and attach provider (email provided by user => not verified)
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          isVerified: false,
          name: profile.name || '',
          isLoggedIn: false,
          avatarUrl: profile.avatarUrl || '',
          authProviders: {
            create: {
              provider,
              providerId,
            },
          },
        },
        include: { authProviders: true },
      });
    } else {
      // user exists: if provider not linked, create a provider record
      const hasProvider = user.authProviders.some(
        (ap) => ap.provider === provider && ap.providerId === providerId,
      );

      if (!hasProvider) {
        // create the provider entry now (you can also require OTP flow instead;
        // original flow sent an OTP after createOrLink — we will keep the same pattern)
        await this.prisma.userAuthProvider.create({
          data: { userId: user.id, provider, providerId },
        });
      }

      // update profile fields
      user = await this.updateUserProfile(
        user,
        profile.name || '',
        profile.avatarUrl || '',
      );
    }

    // Send OTP for verification (email)
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();

    const payload: SocialLoginEmailPayload = {
      email: user.email,
      otp: otp.toString(),
      provider,
      providerId,
    };

    await this.mailService.sendSocialProviderLinkEmail(payload);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp: otp.toString(), otpExpiresAt: expiryTime },
    });

    return successResponse(
      { needsVerification: true, email: user.email },
      'Verification email sent. Please verify your email to continue.',
    );
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
        lastActiveAt: new Date(),
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
        lastActiveAt: new Date(),
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
