import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { EVENT_TYPES } from '@project/common/interface/events-name';
import { ShiftEvent } from '@project/common/interface/events-payload';
import { QueueName } from '@project/common/interface/queue-name';
import { MailService } from '@project/lib/mail/mail.service';
import { NotificationGateway } from '@project/lib/notification/notification.gateway';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { Worker } from 'bullmq';
import { DateTime } from 'luxon';

@Injectable()
export class ShiftWorker implements OnModuleInit {
  private logger = new Logger(ShiftWorker.name);

  constructor(
    private readonly gateway: NotificationGateway,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly utils: UtilsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    new Worker<ShiftEvent>(
      QueueName.SHIFT,
      async (job) => {
        const {
          action,
          meta: { userId, shiftId, ...meta },
        } = job.data;

        try {
          const userEmail = await this.utils.getEmailById(userId);
          const shift = await this.utils.getShiftById(shiftId);

          const message = this.generateMessage(action, shift, meta);
          const title = this.generateTitle(action);
          const eventName = this.generateShiftEventName(action);

          this.logger.log(`Processing shift event: ${action} for ${userEmail}`);

          // Send Email
          await this.mailService.sendEmail(userEmail, title, message);

          // Send Socket Notification
          this.gateway.notifySingleUser(userId, eventName, {
            type: eventName,
            title,
            message:
              'Shift Notification. Pls check your dashboard for more details',
            createdAt: new Date(),
            meta,
          });

          // Store the notification in the database
          await this.prisma.notification.create({
            data: {
              type:
                action === 'URGENT_SHIFT_CHANGED'
                  ? 'UrgentShiftChanged'
                  : 'Shift',
              title,
              message: `Shift Notification for ${shift.shiftTitle} on ${shift.startTime}`,
              createdAt: new Date(),
              meta,
              users: {
                create: { userId },
              },
            },
          });

          this.logger.log(`Shift ${action} notification sent to ${userEmail}`);
        } catch (err) {
          this.logger.error(
            `Failed to process shift event ${action}: ${err.message}`,
            err.stack,
          );
        }
      },
      {
        connection: {
          host: this.config.getOrThrow(ENVEnum.REDIS_HOST),
          port: +this.config.getOrThrow(ENVEnum.REDIS_PORT),
        },
      },
    );
  }

  private generateTitle(action: ShiftEvent['action']): string {
    switch (action) {
      case 'ASSIGN':
        return 'New Shift Assigned';
      case 'STATUS_UPDATE':
        return 'Your Shift Status Updated';
      case 'CHANGE':
        return 'Shift Details Updated';
      case 'URGENT_SHIFT_CHANGED':
        return 'Urgent Shift Changed';
      default:
        return 'Shift Notification';
    }
  }

  private generateMessage(
    action: ShiftEvent['action'],
    shift: any,
    meta: any,
  ): string {
    const start = this.formatShiftTime(new Date(shift.startTime));
    const end = this.formatShiftTime(new Date(shift.endTime));

    // Build optional fields
    const jobLine = shift.job
      ? `<li><strong>Job:</strong> ${shift.job}</li>`
      : '';
    const locationLine = shift.location
      ? `<li><strong>Location:</strong> ${shift.location}</li>`
      : '';
    const noteLine = shift.note
      ? `<li><strong>Note:</strong> ${shift.note}</li>`
      : '';

    const baseDetails = `
    <ul>
      <li><strong>Shift:</strong> ${shift.shiftTitle}</li>
      <li><strong>Start:</strong> ${start.mountain} (${start.utc})</li>
      <li><strong>End:</strong> ${end.mountain} (${end.utc})</li>
      ${jobLine}
      ${locationLine}
      ${noteLine}
    </ul>
  `;

    switch (action) {
      case 'ASSIGN':
        return `
        <p>You have been assigned a new shift.</p>
        ${baseDetails}
      `;
      case 'STATUS_UPDATE':
        return `
        <p>Your shift status has been updated to: <strong>${meta.status || shift.status}</strong>.</p>
        ${baseDetails}
      `;
      case 'CHANGE':
        return `
        <p>Your shift has been updated with new details.</p>
        ${baseDetails}
      `;
      case 'URGENT_SHIFT_CHANGED':
        return `
        <p><strong>Urgent:</strong> Your shift has been changed!</p>
        ${baseDetails}
      `;
      default:
        return `<p>You have a shift update.</p>`;
    }
  }

  private generateShiftEventName(action: ShiftEvent['action']): string {
    switch (action) {
      case 'ASSIGN':
        return EVENT_TYPES.SHIFT_ASSIGN;
      case 'CHANGE':
        return EVENT_TYPES.SHIFT_CHANGE;
      case 'STATUS_UPDATE':
        return EVENT_TYPES.SHIFT_STATUS_UPDATE;
      case 'URGENT_SHIFT_CHANGED':
        return EVENT_TYPES.URGENT_SHIFT_CHANGED;
      default:
        return 'shift.unknown';
    }
  }

  private formatShiftTime(date: Date) {
    const dt = DateTime.fromJSDate(date).toUTC();

    return {
      utc: dt.toFormat("yyyy-LL-dd HH:mm 'UTC'"),
      mountain: dt
        .setZone('America/Denver')
        .toFormat("yyyy-LL-dd hh:mm a 'MT'"),
    };
  }
}
