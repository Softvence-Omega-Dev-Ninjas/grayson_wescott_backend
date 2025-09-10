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
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly twilio: TwilioService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(400, 'User not found');
    if (!user.password)
      throw new AppError(400, 'Please login using your social account');

    const isPasswordCorrect = await this.utils.compare(password, user.password);
    if (!isPasswordCorrect) throw new AppError(400, 'Invalid password');

    // 1. Email verification
    if (!user.isVerified) {
      await this.generateAndSendOtp(email, 'EMAIL', 'VERIFICATION');
      return successResponse(
        { email: user.email },
        'Your email is not verified. A new OTP has been sent to your email.',
      );
    }

    // 2. Two-factor authentication
    if (user.isTwoFAEnabled) {
      if (user.twoFAMethod === 'EMAIL' || user.twoFAMethod === 'PHONE') {
        await this.generateAndSendOtp(email, user.twoFAMethod, 'TFA');
        return successResponse(
          user.twoFAMethod === 'EMAIL'
            ? { email: user.email }
            : { phone: user.phone },
          `Two-factor authentication is enabled. A new OTP has been sent to your ${user.twoFAMethod.toLowerCase()}.`,
        );
      } else if (user.twoFAMethod === 'AUTH_APP') {
        return successResponse(
          { method: 'AUTH_APP' },
          'Two-factor authentication via Authenticator App is enabled. Please submit your TOTP code.',
        );
      }
    }

    // 3. Regular login
    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: { isLoggedIn: true, lastLoginAt: new Date() },
    });

    const token = this.utils.generateToken({
      sub: user.id,
      email: user.email,
      roles: user.role,
    });

    return successResponse(
      {
        user: this.utils.sanitizedResponse(UserResponseDto, updatedUser),
        token,
      },
      'Logged in successfully',
    );
  }

  // Helper: generate and send OTP
  private async generateAndSendOtp(
    email: string,
    method: 'EMAIL' | 'PHONE',
    type: 'VERIFICATION' | 'TFA',
  ): Promise<number> {
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
    const hashedOtp = await this.utils.hash(otp.toString());

    const user = await this.prisma.user.update({
      where: { email },
      data: { otp: hashedOtp, otpExpiresAt: expiryTime, otpType: type },
    });

    if (method === 'EMAIL') {
      await this.mailService.sendVerificationCodeEmail(email, otp.toString(), {
        subject: 'Verify your login',
        message: 'Please verify your email to complete the login process.',
      });
    } else if (method === 'PHONE') {
      await this.twilio.sendTFACode(user.phone || '', otp.toString());
    }

    return otp;
  }
}
