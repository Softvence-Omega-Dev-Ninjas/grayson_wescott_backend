import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { TwilioService } from '@project/lib/twilio/twilio.service';
import { UtilsService } from '@project/lib/utils/utils.service';
// import qrcode from 'qrcode';

@Injectable()
export class AuthTfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
    private readonly twilio: TwilioService,
  ) {}

  @HandleError('Failed to enable 2FA')
  async requestToEnableTfa(
    userId: string,
    method: 'EMAIL' | 'PHONE' | 'AUTH_APP',
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new AppError(404, 'User not found');
    if (!user.isVerified)
      throw new AppError(400, 'User must be verified to enable 2FA');

    // Generate OTP for verification
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
    const hashedOtp = await this.utils.hash(otp.toString());

    switch (method) {
      case 'EMAIL':
      case 'PHONE':
        // * If method is phone and user has no phone number, throw error
        if (method === 'PHONE' && !user.phone) {
          throw new AppError(
            400,
            'User must have a phone number to enable 2FA',
          );
        }

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
          await this.mailService.sendVerificationCodeEmail(
            user.email,
            otp.toString(),
            {
              subject: 'Enable 2FA - OTP',
              message: 'Use this OTP to enable Two-Factor Authentication.',
            },
          );
        } else if (method === 'PHONE' && user.phone) {
          await this.twilio.sendTFACode(user.phone, otp.toString());
        }

        break;

      // case 'AUTH_APP':
      // // Generate TOTP secret
      // const twoFASecret = authenticator.generateSecret();
      // const otpauthUrl = authenticator.keyuri(
      //   user.email,
      //   'CARBON ENGINES',
      //   twoFASecret,
      // );

      // // Generate QR code for frontend
      // const qrCode = await qrcode.toDataURL(otpauthUrl);

      // // Save secret in user record
      // await this.prisma.user.update({
      //   where: { id: userId },
      //   data: { twoFASecret, twoFAMethod: 'AUTH_APP' },
      // });

      // return successResponse(
      //   { qrCode, secret: twoFASecret },
      //   'Scan QR code with your authenticator app to enable 2FA',
      // );

      default:
        throw new AppError(400, 'Invalid 2FA method');
    }

    return successResponse(
      null,
      `Two-factor authentication setup initiated via ${method}. Please verify the OTP.`,
    );
  }
}
