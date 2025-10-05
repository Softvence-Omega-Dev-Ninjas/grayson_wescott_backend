import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { TwilioService } from '@project/lib/twilio/twilio.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { UpdateUserPreferencesDto } from '../dto/update-user-preferences.dto';

@Injectable()
export class UpdateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly twilio: TwilioService,
  ) {}

  @HandleError('Failed to update user preferences', 'User')
  async manageUserPreferences(
    userId: string,
    preferences: UpdateUserPreferencesDto,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        timezone: preferences.timezone || user.timezone,
        allowDirectMessages:
          preferences.allowDirectMessages ?? user.allowDirectMessages,
        allowEmailMessages:
          preferences.allowEmailMessages ?? user.allowEmailMessages,
      },
    });

    return successResponse(
      this.utils.sanitizedResponse(UserResponseDto, updatedUser),
      'User preferences updated successfully',
    );
  }

  @HandleError('Failed to update phone number', 'User')
  async setPhoneNumber(userId: string, phoneNumber: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // REMOVE + from phone number if exists
    if (phoneNumber.startsWith('+')) {
      phoneNumber = phoneNumber.slice(1);
    }

    // Check if the phone number is already in use by another user
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: phoneNumber },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new AppError(400, 'Phone number is already in use');
    }

    // check user already set this phone number
    if (user.phone === phoneNumber) {
      throw new AppError(400, 'This phone number is already set');
    }
    // check if user has a verified phone number
    if (user.isPhoneVerified) {
      throw new AppError(400, 'Already have a verified phone number');
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
      data: {
        otp: hashedOtp,
        otpExpiresAt: expiryTime,
        phone: phoneNumber,
        otpType: 'PHONE_VERIFICATION',
      },
    });

    // 5. Send OTP
    try {
      await this.twilio.sendTFACode(
        phoneNumber,
        `Your verification code is ${otp}. It will expire in 5 minutes.`,
      );
    } catch (error) {
      console.error(error);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otp: null, otpExpiresAt: null, otpType: null, phone: null },
      });
      throw new AppError(
        400,
        'Failed to send OTP SMS. Please try again later.',
      );
    }

    return successResponse(
      { phone: phoneNumber },
      'OTP sent to the new phone number for verification',
    );
  }
}
