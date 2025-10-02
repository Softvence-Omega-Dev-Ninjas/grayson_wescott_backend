import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Job, Worker } from 'bullmq';
import { DateTime } from 'luxon';
import { QueueName } from '../interface/queue-names';
import { QueuePayload } from '../interface/queue-payload';
import { QueueGateway } from '../queue.gateway';

@Injectable()
export class DailyExerciseWorker implements OnModuleInit {
  private logger = new Logger(DailyExerciseWorker.name);

  constructor(
    private readonly gateway: QueueGateway,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    new Worker<QueuePayload>(
      QueueName.DAILY_EXERCISE,
      async (job: Job<QueuePayload>) => {
        const payload = job.data;
        try {
          // 1) Fetch full userProgram + user + program.exercises (worker does the heavy DB read)
          const userProgram = await this.prisma.userProgram.findUnique({
            where: { id: payload.meta.recordId },
            include: {
              user: true,
              program: { include: { exercises: true } },
            },
          });

          if (!userProgram) {
            this.logger.warn(`UserProgram ${payload.meta.recordId} not found.`);
            await job.remove();
            return;
          }

          const userTZ = userProgram.user.timezone || 'UTC';
          const now = DateTime.utc().setZone(userTZ);

          // compute dayNumber
          const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
            userTZ,
          );
          const dayNumber = Math.floor(now.diff(startDate, 'days').days) + 1;
          const dayOfWeek = now.toFormat('EEEE').toUpperCase();

          // filter exercises for today
          const todaysExercises = userProgram.program.exercises.filter(
            (ex) => ex.dayOfWeek === dayOfWeek,
          );

          if (todaysExercises.length) {
            // 2) Create UserProgramExercise rows (skip duplicates)
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

          // 3) Send socket notification
          this.gateway.notifyMultipleUsers(
            payload.recipients.map((r) => r.id),
            payload.type,
            {
              ...payload,
              createdAt: now.toJSDate(),
              meta: {
                ...payload.meta,
                others: {
                  ...(payload.meta.others || {}),
                  dayNumber,
                  dayOfWeek,
                },
              },
            },
          );

          // 4) Persist notification record
          await this.prisma.notification.create({
            data: {
              type: payload.type as any,
              title: payload.title,
              message: payload.message,
              meta: JSON.stringify({
                ...payload.meta,
                others: {
                  ...(payload.meta.others || {}),
                  dayNumber,
                  dayOfWeek,
                },
              }),
              users: {
                createMany: {
                  data: payload.recipients.map((r) => ({ userId: r.id })),
                },
              },
            },
          });

          // 5) Optionally send email here (commented out)
          // await this.emailService.sendNotificationEmail(...)

          // Remove job on success (if you didn't enable removeOnComplete)
          await job.remove();
        } catch (err) {
          this.logger.error(
            `Failed to process DailyExercise job ${job.id}: ${err.message}`,
            err.stack,
          );
          // throw to trigger retry according to attempts/backoff; or handle gracefully
          throw err;
        }
      },
      {
        connection: {
          host: this.config.getOrThrow(ENVEnum.REDIS_HOST),
          port: +this.config.getOrThrow(ENVEnum.REDIS_PORT),
        },
        concurrency: 5, // tune to how many parallel workers you'd like
      },
    );
  }
}
