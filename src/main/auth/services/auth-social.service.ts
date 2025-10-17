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
import { TwitterApi } from 'twitter-api-v2';
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
  async requestTwitterLogin(): Promise<TResponse<any>> {
    const twitterClient = new TwitterApi({
      appKey: this.configService.getOrThrow(ENVEnum.TWITTER_CONSUMER_KEY),
      appSecret: this.configService.getOrThrow(ENVEnum.TWITTER_CONSUMER_SECRET),
    });

    const { url, oauth_token, oauth_token_secret } =
      await twitterClient.generateAuthLink(
        this.configService.getOrThrow(ENVEnum.TWITTER_REDIRECT_URL),
        { linkMode: 'authorize' },
      );

    return successResponse({
      url,
      oauthToken: oauth_token,
      oauthTokenSecret: oauth_token_secret,
    });
  }

  @HandleError('Twitter login failed', 'User')
  async twitterLogin(data: TwitterLoginDto): Promise<TResponse<any>> {
    const provider = AuthProvider.TWITTER;

    if (!data.oauthToken || !data.oauthTokenSecret || !data.oauthVerifier)
      throw new AppError(400, 'Missing OAuth token or verifier');

    const twitterClient = new TwitterApi({
      appKey: this.configService.getOrThrow(ENVEnum.TWITTER_CONSUMER_KEY),
      appSecret: this.configService.getOrThrow(ENVEnum.TWITTER_CONSUMER_SECRET),
      accessToken: data.oauthToken,
      accessSecret: data.oauthTokenSecret,
    });

    // 1️ Exchange request token for access token
    const { client: loggedClient } = await twitterClient.login(
      data.oauthVerifier,
    );

    // 2️ Fetch the user’s profile (with email)
    const user = await loggedClient.v1.verifyCredentials({
      include_email: true,
      include_entities: true,
    });

    const providerId = user.id_str;
    const email = user.email ?? null;
    const name = user.name ?? user.screen_name ?? null;
    const avatarUrl = user.profile_image_url_https ?? null;

    // 3 If we already have a user for this provider
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

    // 4 If email not returned (rare but possible)
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

    // 5️ Try finding user by email
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { authProviders: true },
    });

    let newUser;
    if (!existing) {
      // 5a) Create new user
      newUser = await this.prisma.user.create({
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
      // 5b) Link provider if not linked yet
      const hasProvider = existing.authProviders.some(
        (ap) => ap.provider === provider && ap.providerId === providerId,
      );

      if (!hasProvider) {
        await this.prisma.userAuthProvider.create({
          data: { userId: existing.id, provider, providerId },
        });
      }

      newUser = await this.updateUserProfile(existing, name, avatarUrl);
    }

    const token = this.generateUserToken(newUser);
    return this.buildSuccessResponse(newUser, token);
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
