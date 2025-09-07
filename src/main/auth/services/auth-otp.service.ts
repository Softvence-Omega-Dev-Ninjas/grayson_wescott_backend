import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';

@Injectable()
export class AuthOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
  ) {}

  @HandleError('Failed to resend OTP')
  async resendOtp(email: string): Promise<TResponse<any>> {
    // 1. Find user
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // 2. Prevent multiple active OTPs
    if (user.otp && user.otpExpiresAt && user.otpExpiresAt > new Date()) {
      throw new AppError(
        400,
        'An active OTP already exists. Please check your email.',
      );
    }

    // 3. Generate OTP and expiry
    const otpAndExpiry = this.utils.generateOtpAndExpiry();
    const { otp, expiryTime } = otpAndExpiry;

    const hashedOtp = await this.utils.hash(otp.toString());

    // 4. Save hashed OTP securely
    await this.prisma.user.update({
      where: { email },
      data: {
        otp: hashedOtp,
        otpExpiresAt: expiryTime,
      },
    });

    // 5. Send OTP email
    const emailSent = await this.mailService.sendVerificationCodeEmail(
      email,
      otp.toString(),
      {
        subject: 'Your OTP Code',
        message: `Here is your OTP code. It will expire in 5 minutes.`,
      },
    );
    console.log('Email sent:', emailSent);
    if (!emailSent) {
      // Make otp and expiry null if email fails
      await this.prisma.user.update({
        where: { email },
        data: {
          otp: null,
          otpExpiresAt: null,
        },
      });

      throw new AppError(
        400,
        'Failed to send OTP email. Please try again later.',
      );
    }

    return successResponse(null, 'OTP resent successfully');
  }
}
