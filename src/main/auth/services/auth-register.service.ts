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
import { RegisterDto, VerifyEmailDto } from '../dto/register.dto';

@Injectable()
export class AuthRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Registration failed', 'User')
  async register(dto: RegisterDto): Promise<TResponse<any>> {
    const { email, password, username } = dto;

    // * check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(400, 'User already exists with this email');
    }

    // * check if username already exists
    const existingUsernameUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUsernameUser) {
      throw new AppError(400, 'Username already taken');
    }

    const codeWithExpiry = this.utils.generateOtpAndExpiry();
    const { otp, expiryTime } = codeWithExpiry;

    const hashedOtp = await this.utils.hash(otp.toString());

    // * create new user
    const newUser = await this.prisma.user.create({
      data: {
        email,
        username,
        password: await this.utils.hash(password),
        signUpMethod: 'EMAIL',
        otp: hashedOtp,
        otpExpiresAt: expiryTime,
      },
    });

    await this.mailService.sendVerificationCodeEmail(
      email,
      codeWithExpiry.otp.toString(),
      {
        subject: 'Verify your email',
        message:
          'Welcome to our platform! Your account has been successfully created.',
      },
    );

    return successResponse(
      this.utils.sanitizedResponse(UserResponseDto, newUser),
      'Registration successful. Please verify your email.',
    );
  }

  @HandleError('Email verification failed', 'User')
  async verifyEmail(dto: VerifyEmailDto): Promise<TResponse<any>> {
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
