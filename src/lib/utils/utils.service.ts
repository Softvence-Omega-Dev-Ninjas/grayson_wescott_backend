import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { JWTPayload } from '@project/common/jwt/jwt.interface';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UtilsService {
  private readonly saltRounds = 10;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  sanitizedResponse(sto: any, data: any) {
    return plainToInstance(sto, data, { excludeExtraneousValues: true });
  }

  removeDuplicateIds(ids: string[]) {
    return Array.from(new Set(ids));
  }

  // * AUTH UTILS
  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.saltRounds);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  generateToken(payload: JWTPayload): string {
    const token = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
      expiresIn: this.configService.getOrThrow(ENVEnum.JWT_EXPIRES_IN),
    });

    return token;
  }

  generateOtpAndExpiry(): { otp: number; expiryTime: Date } {
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit code
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);
    return { otp, expiryTime };
  }

  generateResetTokenWithExpiry(payload: JWTPayload): {
    token: string;
    expiryTime: Date;
  } {
    const token = this.generateToken(payload);
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    return { token, expiryTime };
  }

  async getEmailById(id: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'User not found');
    return user.email;
  }

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  }

  formatLastActive(lastActiveAt: Date | null, userTimezone: string): string {
    if (!lastActiveAt) return 'Not logged in';

    const now = DateTime.now().setZone(userTimezone);
    const lastActive = DateTime.fromJSDate(lastActiveAt).setZone(userTimezone);

    const diff = now.diff(lastActive, ['days', 'hours', 'minutes']).toObject();
    const days = Math.floor(diff.days || 0);
    const hours = Math.floor(diff.hours || 0);
    const minutes = Math.floor(diff.minutes || 0);

    if (days <= 0 && hours <= 0 && minutes < 1) return 'Just now';
    if (days <= 0 && hours > 0)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days <= 0 && hours <= 0 && minutes >= 1)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    return `${days} day${days > 1 ? 's' : ''}${
      hours > 0 ? ` ${hours} hour${hours > 1 ? 's' : ''}` : ''
    } ago`;
  }
}
