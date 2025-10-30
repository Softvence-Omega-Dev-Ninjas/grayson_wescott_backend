// src/mail/weekly-review-mail.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '@project/common/error/handle-error.app';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import { MailService } from '../mail.service';
import { weeklyReviewTemplate } from '../templates/weekly-review.template';

@Injectable()
export class WeeklyReviewMailService {
  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async sendWeeklyReviewByAdmin(
    userId: string,
    review: string,
    adminId: string,
  ) {
    const fetchedUser = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true },
    });

    if (!fetchedUser) {
      throw new AppError(404, 'Admin not found');
    }

    const opts = {
      adminName: fetchedUser.name,
      adminEmail: fetchedUser.email,
    };

    // fetch user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, timezone: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }
    if (!user.email) {
      throw new AppError(400, 'Target user does not have an email');
    }

    // timezone fallback
    const timezone =
      user.timezone || this.config.get<string>('DEFAULT_TIMEZONE') || 'UTC';

    // timestamp formatted in user's timezone
    const sentAt = DateTime.now().setZone(timezone);

    const formattedSentAt = sentAt.toFormat('EEEE, LLL d, yyyy • t z'); // e.g. Friday, Oct 31, 2025 • 3:00 AM Asia/Dhaka

    const adminName = opts?.adminName ?? 'Admin';
    const adminEmail =
      opts?.adminEmail ??
      this.config.get<string>('SUPPORT_EMAIL') ??
      'support@example.com';

    // create subject
    const subject = `Weekly Review from ${adminName} — ${sentAt.toFormat('LLL d, yyyy')}`;

    // create html and plain text
    const html = weeklyReviewTemplate(
      user.name ?? 'there',
      review,
      adminName,
      adminEmail,
      formattedSentAt,
      timezone,
    );

    const text = this.buildPlainTextFallback(
      user.name ?? 'there',
      review,
      adminName,
      adminEmail,
      formattedSentAt,
      timezone,
    );

    // send mail
    return this.mailService.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  private buildPlainTextFallback(
    userName: string,
    review: string,
    adminName: string,
    adminEmail: string,
    formattedSentAt: string,
    frontendUrl: string,
  ) {
    // minimal sanitization for plain text
    const cleanReview = review.replace(/\r\n|\r|\n/g, '\n').trim();

    return [
      `Hi ${userName},`,
      '',
      `You received a weekly review from ${adminName} (${adminEmail}) on ${formattedSentAt}.`,
      '',
      '— Review —',
      cleanReview,
      '',
      'What you can do next:',
      `• View your dashboard: ${frontendUrl}`,
      `• Reply / request clarification via the app.`,
      '',
      'If you need help, reply to this email or contact support.',
      '',
      'Best,',
      `${adminName}`,
    ].join('\n');
  }
}
