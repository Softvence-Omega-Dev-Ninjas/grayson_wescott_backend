import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { AuthMailService } from '@project/lib/mail/services/auth-mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { TwilioService } from '@project/lib/twilio/twilio.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import * as OTPAuth from 'otpauth';
import qrcode from 'qrcode';
import { VerifyTfaDto } from '../dto/verify-tfa.dto';

@Injectable()
export class AuthTfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly authMailService: AuthMailService,
    private readonly twilio: TwilioService,
  ) {}

  /** Request to enable 2FA */
  @HandleError('Failed to enable 2FA')
  async requestToEnableTfa(
    userId: string,
    method: 'EMAIL' | 'PHONE' | 'AUTH_APP',
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError(404, 'User not found');
    if (!user.isVerified)
      throw new AppError(400, 'User must be verified to enable 2FA');

    switch (method) {
      case 'EMAIL':
      case 'PHONE': {
        if (method === 'PHONE' && !user.phone) {
          throw new AppError(
            400,
            'User must have a phone number to enable 2FA',
          );
        }

        const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
        const hashedOtp = await this.utils.hash(otp.toString());

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            otp: hashedOtp,
            otpExpiresAt: expiryTime,
            otpType: 'TFA',
            twoFAMethod: method,
          },
        });

        if (method === 'EMAIL') {
          await this.authMailService.sendVerificationCodeEmail(
            user.email,
            otp.toString(),
            {
              subject: 'Enable 2FA - OTP',
              message: 'Use this OTP to enable Two-Factor Authentication.',
            },
          );
        } else {
          await this.twilio.sendTFACode(user.phone!, otp.toString());
        }

        return successResponse(
          null,
          `2FA setup initiated via ${method}. Please verify the OTP.`,
        );
      }

      case 'AUTH_APP': {
        const secret = new OTPAuth.Secret(); // Generates a random secret
        const secretBase32 = secret.base32; // Store this in DB and show to user

        // Generate TOTP secret
        const totp = this.generateTotp(secretBase32);

        const otpAuthUrl = totp.toString();
        const qrCode = await qrcode.toDataURL(otpAuthUrl);

        // Save secret
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            twoFASecret: secretBase32,
            twoFAMethod: 'AUTH_APP',
            otpType: 'TFA', // * IMPORTANT for verification
          },
        });

        return successResponse(
          { qrCode, secret: secretBase32 },
          'Scan this QR code with your Authenticator App to enable 2FA',
        );
      }

      default:
        throw new AppError(400, 'Invalid 2FA method');
    }
  }

  /** Verify 2FA setup request */
  @HandleError('Failed to verify 2FA setup')
  async verifyTfaSetup(
    userId: string,
    dto: VerifyTfaDto,
  ): Promise<TResponse<any>> {
    const { otp: code, method } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'User not found');

    switch (method) {
      case 'EMAIL':
      case 'PHONE': {
        if (!user.otp || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
          throw new AppError(400, 'OTP expired or not found');
        }

        const isValid = await this.utils.compare(code, user.otp);
        if (!isValid) throw new AppError(400, 'Invalid OTP');

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            isTwoFAEnabled: true,
            otp: null,
            otpExpiresAt: null,
            otpType: null,
          },
        });

        return successResponse(null, '2FA enabled successfully');
      }

      case 'AUTH_APP': {
        if (!user.twoFASecret) throw new AppError(400, '2FA secret not found');

        const totp = this.generateTotp(user.twoFASecret);

        if (!totp.validate({ token: code })) {
          throw new AppError(400, 'Invalid 2FA code');
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: { isTwoFAEnabled: true, otpType: null },
        });

        return successResponse(null, '2FA enabled successfully');
      }

      default:
        throw new AppError(400, 'Invalid 2FA method');
    }
  }

  /** Disable 2FA */
  @HandleError('Failed to disable 2FA')
  async disableTfa(userId: string): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError(404, 'User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFAMethod: null, twoFASecret: null, isTwoFAEnabled: false },
    });

    return successResponse(null, '2FA disabled successfully');
  }

  public generateTotp(secret: string): OTPAuth.TOTP {
    return new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
  }
}
