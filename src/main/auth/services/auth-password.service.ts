import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { ChangePasswordDto, ResetPasswordDto } from '../dto/password.dto';

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @HandleError('Failed to change password')
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // If user registered via Social login and has no password set
    if (!user.password) {
      const hashedPassword = await this.utils.hash(dto.newPassword);
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      return successResponse(null, 'Password set successfully');
    }

    // For normal email/password users — require current password check
    if (!dto.password) {
      throw new AppError(400, 'Current password is required');
    }

    const isPasswordValid = await this.utils.compare(
      dto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new AppError(400, 'Invalid current password');
    }

    const hashedPassword = await this.utils.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return successResponse(null, 'Password updated successfully');
  }

  @HandleError('Failed to send password reset email')
  async forgotPassword(email: string): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // prevent multiple active reset tokens
    if (
      user.resetToken &&
      user.resetTokenExpiresAt &&
      user.resetTokenExpiresAt > new Date()
    ) {
      throw new AppError(
        400,
        'A reset link was already sent. Please check your email.',
      );
    }

    const tokenWithExpiry = this.utils.generateResetTokenWithExpiry({
      sub: user.id,
      email: user.email,
      roles: user.role,
    });

    const { token, expiryTime } = tokenWithExpiry;

    const hashedToken = await this.utils.hash(token);

    await this.prisma.user.update({
      where: { email },
      data: {
        resetToken: hashedToken,
        resetTokenExpiresAt: expiryTime,
      },
    });

    const baseUrl = this.configService.getOrThrow<string>(
      ENVEnum.FRONTEND_RESET_PASSWORD_URL,
    );

    const resetLink = `${baseUrl}?token=${token}&email=${email}`;

    await this.mailService.sendResetPasswordLinkEmail(email, resetLink);

    return successResponse(null, 'Password reset email sent');
  }

  @HandleError('Failed to reset password')
  async resetPassword(dto: ResetPasswordDto): Promise<TResponse<any>> {
    const { token, email, newPassword } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // * Check if reset token exists
    if (!user.resetToken || !user.resetTokenExpiresAt) {
      throw new AppError(
        404,
        'No reset token found. Please request a new one.',
      );
    }

    // check expiry
    if (user.resetTokenExpiresAt < new Date()) {
      throw new AppError(
        401,
        'Reset token has expired. Please request a new one.',
      );
    }

    // verify token
    const isMatch = this.utils.compare(token, user.resetToken);
    if (!isMatch) {
      throw new AppError(403, 'Invalid reset token');
    }

    // hash new password
    const hashedPassword = await this.utils.hash(newPassword);

    // update password and invalidate reset token
    await this.prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    // send email
    await this.mailService.sendPasswordResetConfirmationEmail(email);

    return successResponse(null, 'Password reset successfully');
  }
}
