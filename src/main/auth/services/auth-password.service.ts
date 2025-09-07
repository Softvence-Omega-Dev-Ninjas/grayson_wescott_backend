import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { MailService } from '@project/lib/mail/mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { ChangePasswordDto } from '../dto/password.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly mailService: MailService,
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
}
