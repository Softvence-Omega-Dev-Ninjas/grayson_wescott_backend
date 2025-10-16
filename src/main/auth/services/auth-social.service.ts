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
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import axios from 'axios';
import { FacebookLoginDto, TwitterLoginDto } from '../dto/social-login.dto';

@Injectable()
export class AuthSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly configService: ConfigService,
  ) {}

  @HandleError('Facebook login failed', 'User')
  async facebookLogin(dto: FacebookLoginDto): Promise<TResponse<any>> {
    const { accessToken } = dto;
    const provider = AuthProvider.FACEBOOK;

    if (!accessToken) throw new AppError(400, 'Access token is required');

    const res = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email,picture', access_token: accessToken },
    });

    const profile = {
      providerId: res.data.id,
      email: res.data.email ?? null,
      name: res.data.name ?? null,
      avatarUrl: res.data.picture?.data?.url ?? null,
    };

    const { providerId, email, name, avatarUrl } = profile;

    // 1) If a user already exists for this providerId -> update + return
    const providerUser = await this.findUserByProviderId(provider, providerId);
    if (providerUser) {
      const updated = await this.updateUserProfile(
        providerUser,
        name,
        avatarUrl,
      );
      const token = this.generateUserToken(updated);
      return this.buildSuccessResponse(updated, token);
    }

    // 2) No provider-linked user. If provider didn't give email, ask frontend for it.
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

    const normalizedEmail = email.toLowerCase();

    // 3) Try to find existing user by email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authProviders: true },
    });

    let user;
    if (!existing) {
      // 3a) Create new user and attach provider
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          isVerified: true, // Facebook email considered verified
          name: name || '',
          isLoggedIn: true,
          lastLoginAt: new Date(),
          avatarUrl: avatarUrl || '',
          authProviders: {
            create: { provider, providerId },
          },
        },
        include: { authProviders: true },
      });
    } else {
      // 3b) Existing user found by email -> link provider if needed
      const hasProvider = existing.authProviders.some(
        (ap) => ap.provider === provider && ap.providerId === providerId,
      );

      if (!hasProvider) {
        await this.prisma.userAuthProvider.create({
          data: { userId: existing.id, provider, providerId },
        });
      }

      // keep profile updated and treat as login
      user = await this.updateUserProfile(existing, name, avatarUrl);
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
  }

  @HandleError('Twitter login failed', 'User')
  async twitterLogin(dto: TwitterLoginDto): Promise<TResponse<any>> {
    const { code, codeVerifier } = dto;
    const provider = AuthProvider.TWITTER;

    if (!code) throw new AppError(400, 'Authorization code is required');

    if (!codeVerifier) throw new AppError(400, 'Code verifier is required');

    // Exchange code for access token (PKCE flow)
    const body = new URLSearchParams({
      client_secret: this.configService.getOrThrow(
        ENVEnum.TWITTER_CLIENT_SECRET,
      ),
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: this.configService.getOrThrow(ENVEnum.TWITTER_REDIRECT_URL),
      code,
    });

    const tokenRes = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      body.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const accessToken = tokenRes?.data?.access_token;
    if (!accessToken)
      throw new AppError(400, 'Failed to obtain access token from Twitter');

    // Fetch Twitter profile (try to request email; may be null)
    const profileRes = await axios.get('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { 'user.fields': 'id,name,username,profile_image_url,email' },
    });

    if (!profileRes?.data?.data)
      throw new AppError(400, 'Failed to obtain user profile from Twitter');

    const d = profileRes.data?.data;
    const providerId = d?.id;
    const email = d?.email ?? null;
    const name = d?.name ?? d?.username ?? null;
    const avatarUrl = d?.profile_image_url ?? null;

    // 1) Check if provider-linked user exists
    const providerUser = await this.findUserByProviderId(provider, providerId);
    if (providerUser) {
      const updated = await this.updateUserProfile(
        providerUser,
        name,
        avatarUrl,
      );
      const token = this.generateUserToken(updated);
      return this.buildSuccessResponse(updated, token);
    }

    // 2) If provider did not return email
    if (!email) {
      return successResponse(
        {
          needsEmail: true,
          provider,
          providerId,
          name: name || '',
          avatarUrl: avatarUrl || '',
        },
        `${provider} did not return an email. Please provide one to continue.`,
      );
    }

    const normalizedEmail = email.toLowerCase();

    // 3) Try to find existing user by email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authProviders: true },
    });

    let user;
    if (!existing) {
      // 3a) Create new user
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          isVerified: true,
          name: name || '',
          isLoggedIn: true,
          lastLoginAt: new Date(),
          avatarUrl: avatarUrl || '',
          authProviders: {
            create: { provider, providerId },
          },
        },
        include: { authProviders: true },
      });
    } else {
      // 3b) Link provider if needed
      const hasProvider = existing.authProviders.some(
        (ap) => ap.provider === provider && ap.providerId === providerId,
      );

      if (!hasProvider) {
        await this.prisma.userAuthProvider.create({
          data: { userId: existing.id, provider, providerId },
        });
      }

      user = await this.updateUserProfile(existing, name, avatarUrl);
    }

    const token = this.generateUserToken(user);
    return this.buildSuccessResponse(user, token);
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
        isVerified: true,
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
