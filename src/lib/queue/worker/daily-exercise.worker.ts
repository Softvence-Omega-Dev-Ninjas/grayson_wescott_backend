import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { CronMailService } from '@project/lib/mail/services/cron-mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { TwilioService } from '@project/lib/twilio/twilio.service';
import { Job, Worker } from 'bullmq';
import { DateTime } from 'luxon';
import { QUEUE_EVENTS } from '../interface/queue-events';
import { QueueName } from '../interface/queue-names';
import { DailyExerciseJobPayload } from '../payload/daily-exercise.payload';
import { QueueGateway } from '../queue.gateway';

@Injectable()
export class DailyExerciseWorker implements OnModuleInit {
  private logger = new Logger(DailyExerciseWorker.name);

  constructor(
    private readonly gateway: QueueGateway,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: CronMailService,
    private readonly twilio: TwilioService,
  ) {}

  onModuleInit() {
    new Worker<DailyExerciseJobPayload>(
      QueueName.DAILY_EXERCISE,
      async (job: Job<DailyExerciseJobPayload>) => {
        const payload = job.data;
        try {
          // 1) Fetch full userProgram + user + program.exercises
          const userProgram = await this.prisma.userProgram.findUnique({
            where: { id: payload.programId },
            include: {
              user: true,
              program: {
                include: {
                  exercises: true,
                },
              },
            },
          });

          if (!userProgram) {
            this.logger.warn(`UserProgram ${payload.programId} not found.`);
            await job.remove();
            return;
          }

          // 2) compute user-local "now", dayNumber and dayOfWeek using Luxon
          const userTZ = userProgram.user.timezone || 'UTC';
          const now = DateTime.utc().setZone(userTZ);
          const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
            userTZ,
          );
          const dayNumber = Math.floor(now.diff(startDate, 'days').days) + 1;
          const dayOfWeek = now.toFormat('EEEE').toUpperCase();

          // 3) pick today's exercises
          const todaysExercises = userProgram.program.exercises
            .filter((ex) => ex.dayOfWeek === dayOfWeek)
            .sort((a, b) => a.order - b.order);

          // 4) create UserProgramExercise rows for today (skip duplicates)
          if (todaysExercises.length) {
            await this.prisma.userProgramExercise.createMany({
              data: todaysExercises.map((ex) => ({
                userProgramId: userProgram.id,
                programExerciseId: ex.id,
                status: 'PENDING',
                dayNumber,
              })),
              skipDuplicates: true,
            });
          }

          // 6) Persist notification record (title/message built here dynamically)
          const title = `${userProgram.program.name} — Day ${dayNumber}`;
          const message = `${todaysExercises.length} exercise(s) for ${dayOfWeek}`;

          await this.prisma.notification.create({
            data: {
              type: QUEUE_EVENTS.DAILY_EXERCISE,
              title,
              message,
              createdAt: new Date(),
              meta: {
                recordType: payload.recordType,
                recordId: payload.recordId,
                performedBy: 'Automation System',
              },
              users: {
                createMany: {
                  data: [{ userId: userProgram.user.id }],
                },
              },
            },
          });

          // 7) Emit socket notification
          if (!payload.channels || payload.channels.includes('socket')) {
            this.gateway.notifySingleUser(
              userProgram.user.id,
              QUEUE_EVENTS.DAILY_EXERCISE,
              {
                title,
                message,
                type: QUEUE_EVENTS.DAILY_EXERCISE,
                createdAt: new Date(),
                meta: {
                  recordType: payload.recordType,
                  recordId: payload.recordId,
                  performedBy: 'Automation System',
                },
              },
            );
          }

          // 8) Send email notification
          if (!payload.channels || payload.channels.includes('email')) {
            // TODO: send email
          }

          // 9) Send SMS notification
          if (!payload.channels || payload.channels.includes('sms')) {
            // TODO: send SMS
          }

          // remove job on success
          await job.remove();
        } catch (err) {
          this.logger.error(
            `Failed to process job ${job.id}: ${err?.message}`,
            err?.stack,
          );
          throw err; // allow BullMQ retry/backoff to handle it
        }
      },
      {
        connection: {
          host: this.config.getOrThrow(ENVEnum.REDIS_HOST),
          port: +this.config.getOrThrow(ENVEnum.REDIS_PORT),
        },
        concurrency: 5,
      },
    );
  }
}
