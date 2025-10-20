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
    this.logger.log(
      `Processing job for ${payload.recordType} ${payload.recordId}`,
    );

    try {
      // 1) Fetch userProgram + user + program.exercises
      const userProgram = await this.prisma.userProgram.findUnique({
        where: { id: payload.recordId },
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
        this.logger.warn(`UserProgram ${payload.recordId} not found.`);
        return;
      }

      // 2) compute user-local "now", dayNumber and dayOfWeek
      const userTZ = userProgram.user.timezone || 'UTC';
      const now = DateTime.utc().setZone(userTZ);
      const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
        userTZ,
      );
      const diffInDays = now
        .startOf('day')
        .diff(startDate.startOf('day'), 'days').days;
      const dayNumber = Math.floor(diffInDays) + 1; // 1-based index
      const dayOfWeek = now.toFormat('EEEE').toUpperCase();

      // 3) Check if today's exercises already created for this user/day
      const existing = await this.prisma.userProgramExercise.findFirst({
        where: {
          userProgramId: userProgram.id,
          dayNumber,
        },
      });

      if (existing) {
        this.logger.warn(
          `Exercises already created for UserProgram ${userProgram.id}, Day ${dayNumber}`,
        );
        return; // exit early so we don’t create duplicates or send duplicate notifications
      }

      // 4) pick today's exercises
      const todaysExercises = userProgram.program.exercises
        .filter((ex) => ex.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.order - b.order);

      if (!todaysExercises.length) {
        this.logger.log(
          `No exercises scheduled for UserProgram ${userProgram.id} on ${dayOfWeek}.`,
        );
        return;
      }

      // 5) create UserProgramExercise rows
      const userProgramExercises =
        await this.prisma.userProgramExercise.createMany({
          data: todaysExercises.map((ex) => ({
            userProgramId: userProgram.id,
            programExerciseId: ex.id,
            status: 'PENDING',
            dayNumber,
          })),
          skipDuplicates: true,
        });
      this.logger.log(
        `Created ${userProgramExercises.count} UserProgramExercise(s) for UserProgram ${userProgram.id}, Day ${dayNumber}`,
      );

      // 6) Notification record
      const title = `${userProgram.program.name} — Day ${dayNumber}`;
      const message = `${todaysExercises.length} exercise(s) for ${dayOfWeek}`;

      const notification = await this.prisma.notification.create({
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
            create: {
              user: {
                connect: {
                  id: userProgram.user.id,
                },
              },
            },
          },
        },
      });
      this.logger.log(
        `Notification ${notification.id} created for user ${userProgram.user.id}`,
      );

      // 7) Socket notification
      if (!payload.channels || payload.channels.includes('socket')) {
        this.logger.log(
          `Socket notification sent to user ${userProgram.user.id} for job ${job.id}`,
        );
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

      const exercisesList = todaysExercises.map((ex) => ex.title);
      const email = userProgram.user.email;
      const phone = userProgram.user.phone;

      // 8) Email notification
      if (!payload.channels || payload.channels.includes('email')) {
        try {
          await this.mail.sendDailyExerciseEmail(email, {
            userName: userProgram.user.name || 'there',
            title: userProgram.program.name,
            exercises: todaysExercises,
          });
          this.logger.log(`Email sent to ${email} for job ${job.id}`);
        } catch (err) {
          this.logger.error(
            `Failed to send email to ${email} for job ${job.id}: ${err.message}`,
          );
        }
      }

      // 9) SMS notification
      if (!payload.channels || payload.channels.includes('sms')) {
        if (phone) {
          try {
            const smsBody = [
              `Hi ${userProgram.user.name || 'there'},`,
              `Your program: ${userProgram.program.name}`,
              `Day ${dayNumber} (${dayOfWeek})`,
              `You have ${todaysExercises.length} exercise(s) today:`,
              exercisesList,
            ].join('\n');

            // Basic sanity validation (length + phone format)
            if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
              this.logger.error(`Invalid phone number format: ${phone}`);
              return;
            }
            if (smsBody.length > 1000) {
              this.logger.warn(
                `SMS body too long (${smsBody.length} chars). Trimming.`,
              );
            }

            await this.twilio.sendSMS(phone, smsBody.slice(0, 1000)); // Twilio limit safeguard
            this.logger.log(
              `SMS notification sent to ${phone} for job ${job.id}`,
            );
          } catch (smsErr) {
            this.logger.error(
              `Failed to send SMS to ${phone} for job ${job.id}: ${smsErr.message}`,
            );
          }
        } else {
          this.logger.warn(
            `User ${userProgram.user.id} has no phone number, skipping SMS`,
          );
        }
      }

      this.logger.log(`Job ${job.id} processed successfully.`);
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
