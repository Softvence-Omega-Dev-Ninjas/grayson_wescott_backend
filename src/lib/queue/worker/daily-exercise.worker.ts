import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CronMailService } from '@project/lib/mail/services/cron-mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { TwilioService } from '@project/lib/twilio/twilio.service';
import { Job } from 'bullmq';
import { DateTime } from 'luxon';
import { QUEUE_EVENTS } from '../interface/queue-events';
import { QueueName } from '../interface/queue-names';
import { DailyExerciseJobPayload } from '../payload/daily-exercise.payload';
import { QueueGateway } from '../queue.gateway';

@Processor(QueueName.DAILY_EXERCISE, { concurrency: 5 })
export class DailyExerciseWorker extends WorkerHost {
  private readonly logger = new Logger(DailyExerciseWorker.name);

  constructor(
    private readonly gateway: QueueGateway,
    private readonly prisma: PrismaService,
    private readonly mail: CronMailService,
    private readonly twilio: TwilioService,
  ) {
    super();
  }

  // This is the job handler
  async process(job: Job<DailyExerciseJobPayload>): Promise<void> {
    const payload = job.data;

    try {
      // 1) Fetch userProgram + user + program.exercises
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

      // 2) compute user-local "now", dayNumber and dayOfWeek
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

      // 4) create UserProgramExercise rows
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

      // 5) Notification record
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

      // 6) Socket notification
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

      // 7) Email notification
      if (!payload.channels || payload.channels.includes('email')) {
        // TODO: send via this.mail
      }

      // 8) SMS notification
      if (!payload.channels || payload.channels.includes('sms')) {
        // TODO: send via this.twilio
      }

      await job.remove();
    } catch (err) {
      this.logger.error(
        `Failed to process job ${job.id}: ${err?.message}`,
        err?.stack,
      );
      throw err; // let BullMQ retry/backoff handle it
    }
  }

  // Optional job lifecycle events
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(`Job ${job.id} failed: ${err?.message}`);
  }
}
