import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
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
import { VerifyOTPDto } from '../dto/otp.dto';

@Injectable()
export class AuthOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
    private readonly twilio: TwilioService,
  ) {}

  @HandleError('Failed to resend OTP')
  async resendOtp(email?: string, phone?: string): Promise<TResponse<any>> {
    if (!email && !phone) {
      throw new AppError(400, 'Email or phone must be provided');
    }

    // 1. Find user by email or phone
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // 2. Prevent multiple active OTPs
    if (user.otp && user.otpExpiresAt && user.otpExpiresAt > new Date()) {
      throw new AppError(
        400,
        'An active OTP already exists. Please check your inbox.',
      );
    }

    // 3. Generate OTP and expiry
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
    const hashedOtp = await this.utils.hash(otp.toString());

    // 4. Save hashed OTP
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otp: hashedOtp, otpExpiresAt: expiryTime },
    });

    // 5. Send OTP
    if (email) {
      const emailSent = await this.mailService.sendVerificationCodeEmail(
        email,
        otp.toString(),
        {
          subject: 'Your OTP Code',
          message: `Here is your OTP code. It will expire in 5 minutes.`,
        },
      );

      if (!emailSent) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { otp: null, otpExpiresAt: null, otpType: null },
        });
        throw new AppError(
          400,
          'Failed to send OTP email. Please try again later.',
        );
      }
    } else if (phone) {
      await this.twilio.sendTFACode(phone, otp.toString());
    }

    return successResponse(null, 'OTP resent successfully');
  }

  @HandleError('OTP verification failed', 'User')
  async verifyOTP(dto: VerifyOTPDto): Promise<TResponse<any>> {
    const { email, phone, otp } = dto;

    if (!email && !phone) {
      throw new AppError(400, 'Email or phone must be provided');
    }

    // 1. Find user by email or phone
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (!user) throw new AppError(400, 'User not found');

    if (!user.otp || !user.otpExpiresAt) {
      throw new AppError(400, 'OTP is not set. Please request a new one.');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    const isCorrectOtp = await this.utils.compare(otp, user.otp);
    if (!isCorrectOtp) {
      throw new AppError(400, 'Invalid OTP');
    }

    // 2. Mark user verified (if not already)
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
        otpType: null,
        isLoggedIn: true,
        lastLoginAt: new Date(),
        isTwoFAEnabled: user.otpType === 'TFA' ? true : user.isTwoFAEnabled, // * Only enable TFA if OTP is for TFA, otherwise keep the existing value
      },
    });

    const token = this.utils.generateToken({
      sub: updatedUser.id,
      email: updatedUser.email,
      roles: updatedUser.role,
    });

    return successResponse(
      {
        user: this.utils.sanitizedResponse(UserResponseDto, updatedUser),
        token,
      },
      'OTP verified successfully',
    );
  }
}
