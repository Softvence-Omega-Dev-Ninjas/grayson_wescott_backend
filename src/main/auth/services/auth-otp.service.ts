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
import { UtilsService } from '@project/lib/utils/utils.service';
import { VerifyOTPDto } from '../dto/otp.dto';

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
    if (!emailSent) {
      // Make otp and expiry null if email fails
      await this.prisma.user.update({
        where: { email },
        data: {
          otp: null,
          otpExpiresAt: null,
          otpType: null,
        },
      });

      throw new AppError(
        400,
        'Failed to send OTP email. Please try again later.',
      );
    }

    return successResponse(null, 'OTP resent successfully');
  }

  @HandleError('Email verification failed', 'User')
  async verifyOTP(dto: VerifyOTPDto): Promise<TResponse<any>> {
    const { email, otp } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(400, 'User not found');
    }

    if (user.isVerified) {
      throw new AppError(400, 'User already verified');
    }

    if (!user.otp || !user.otpExpiresAt) {
      throw new AppError(400, 'OTP is not set. Please request a new one.');
    }

    const isCorrectOtp = await this.utils.compare(otp, user.otp);
    if (!isCorrectOtp) {
      throw new AppError(400, 'Invalid OTP');
    }

    if (user.otpExpiresAt < new Date()) {
      throw new AppError(400, 'OTP has expired. Please request a new one.');
    }

    await this.prisma.user.update({
      where: { email },
      data: {
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
        otpType: null,
        isLoggedIn: true,
        lastLoginAt: new Date(),
      },
    });

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
      'Email verified successfully',
    );
  }
}
