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
import { RegisterDto } from '../dto/register.dto';

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

    // Check if user email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new AppError(400, 'User already exists with this email');
    }

    // Check if username already exists
    const existingUsernameUser = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUsernameUser) {
      throw new AppError(400, 'Username already taken');
    }

    // Generate OTP and expiry
    const { otp, expiryTime } = this.utils.generateOtpAndExpiry();
    const hashedOtp = await this.utils.hash(otp.toString());

    // Create new user
    const newUser = await this.prisma.user.create({
      data: {
        email,
        username,
        password: await this.utils.hash(password),
        signUpMethod: 'EMAIL',
        otp: hashedOtp,
        otpType: 'VERIFICATION',
        otpExpiresAt: expiryTime,
      },
    });

    // Send verification email
    await this.mailService.sendVerificationCodeEmail(email, otp.toString(), {
      subject: 'Verify your email',
      message:
        'Welcome to our platform! Your account has been successfully created.',
    });

    // Return sanitized response
    return successResponse(
      this.utils.sanitizedResponse(UserResponseDto, newUser),
      'Registration successful. Please verify your email.',
    );
  }
}
