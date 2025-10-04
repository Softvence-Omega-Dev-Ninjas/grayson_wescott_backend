import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail.service';
import { dailyExerciseTemplate } from '../templates/daily-exercise.template';
import { ProgramExercise } from '@prisma/client';

@Injectable()
export class CronMailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async sendDailyExerciseEmail(
    to: string,
    {
      userName,
      title,
      exercises,
    }: {
      userName: string;
      title: string;
      exercises: ProgramExercise[];
    },
  ) {
    const subject = `Your Daily Exercises for "${title}"`;
    const html = dailyExerciseTemplate(userName, title, exercises);
    const safeTitle = title.replace(/<\/?[^>]+(>|$)/g, ''); // optional sanitization

    const text = `Hello ${userName},\n\nHere are your exercises for today in the "${safeTitle}" program:\n\n${exercises
      .map((ex, idx) => `${idx + 1}. ${ex}`)
      .join('\n')}\n\nKeep up the great work!\n\nBest,\nThe Team`;

    return this.mailService.sendMail({
      to,
      subject,
      html,
      text,
    });
  }
}
