import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { LoginDto } from '../dto/login.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    // * check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(400, 'User not found');
    }

    if (!user.password) {
      throw new AppError(400, 'Please login using your social account');
    }

    // * check if password is correct
    const isPasswordCorrect = await this.utils.compare(password, user.password);

    if (!isPasswordCorrect) {
      throw new AppError(400, 'Invalid password');
    }

    // * if user is not verified
    if (!user.isVerified) {
      const codeWithExpiry = this.utils.generateOtpAndExpiry();
      const { otp, expiryTime } = codeWithExpiry;

      const hashedOtp = await this.utils.hash(otp.toString());

      await this.prisma.user.update({
        where: { email },
        data: {
          otp: hashedOtp,
          otpExpiresAt: expiryTime,
        },
      });

      await this.mailService.sendVerificationCodeEmail(
        user.email,
        otp.toString(),
        {
          message: 'Please verify your email to complete the login process.',
          subject: 'Verify your email to login',
        },
      );

      return successResponse(
        { email: user.email },
        'Your email is not verified. A new OTP has been sent to your email.',
      );
    }

    // * TODO: Handle TFA

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
      'Logged in successfully',
    );
  }
}
