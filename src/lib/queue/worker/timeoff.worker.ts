import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { EVENT_TYPES } from '@project/common/interface/events-name';
import { TimeOffEvent } from '@project/common/interface/events-payload';
import { QueueName } from '@project/common/interface/queue-name';
import { MailService } from '@project/lib/mail/mail.service';
import { NotificationGateway } from '@project/lib/notification/notification.gateway';
import { UtilsService } from '@project/lib/utils/utils.service';
import { Worker } from 'bullmq';
import { DateTime } from 'luxon';

@Injectable()
export class TimeOffWorker implements OnModuleInit {
  private logger = new Logger(TimeOffWorker.name);

  constructor(
    private readonly gateway: NotificationGateway,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly utils: UtilsService,
  ) {}

  onModuleInit() {
    new Worker<TimeOffEvent>(
      QueueName.TIME_OFF,
      async (job) => {
        const { action, meta } = job.data;

        try {
          const userEmail = await this.utils.getEmailById(meta.userId);

          const message = this.generateMessage(action, meta);
          const title = this.generateTitle(action);
          const eventName = this.generateTimeOffEventName(action);

          this.logger.log(
            `Processing time off event: ${action} for ${userEmail}`,
          );

          // Send Email
          await this.mailService.sendEmail(userEmail, title, message);

          // Send Socket Notification
          this.gateway.notifySingleUser(meta.userId, eventName, {
            type: eventName,
            title,
            message,
            createdAt: new Date(),
            meta,
          });

          this.logger.log(
            `Time off ${action} notification sent to ${userEmail}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to process time off event ${action}: ${err.message}`,
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

  private generateTitle(action: TimeOffEvent['action']): string {
    switch (action) {
      case 'CREATE':
        return 'Time Off Request Created';
      case 'DELETE':
        return 'Time Off Request Deleted';
      case 'UPDATE':
        return 'Time Off Request Updated';
      case 'STATUS_CHANGE':
        return 'Time Off Request Status Changed';
      default:
        return 'Time Off Notification';
    }
  }

  private generateMessage(
    action: TimeOffEvent['action'],
    timeOff: TimeOffEvent['meta'],
  ): string {
    const start = this.formatDate(timeOff.startDate);
    const end = this.formatDate(timeOff.endDate);

    switch (action) {
      case 'CREATE':
        return `
        <p>Your time off request has been created.</p>
        <p><strong>From:</strong> ${start.mountain} (${start.utc})</p>
        <p><strong>To:</strong> ${end.mountain} (${end.utc})</p>
      `;
      case 'DELETE':
        return `
        <p>Your time off request has been deleted.</p>
        <p><strong>From:</strong> ${start.mountain} (${start.utc})</p>
        <p><strong>To:</strong> ${end.mountain} (${end.utc})</p>
      `;
      case 'UPDATE':
        return `
        <p>Your time off request has been updated.</p>
        <p><strong>New From:</strong> ${start.mountain} (${start.utc})</p>
        <p><strong>New To:</strong> ${end.mountain} (${end.utc})</p>
      `;
      case 'STATUS_CHANGE':
        return `
        <p>The status of your time off request has changed to: 
        <strong>${timeOff.status}</strong>.</p>
        <p><strong>From:</strong> ${start.mountain} (${start.utc})</p>
        <p><strong>To:</strong> ${end.mountain} (${end.utc})</p>
      `;
      default:
        return `<p>You have a new time off notification.</p>`;
    }
  }

  private generateTimeOffEventName(action: TimeOffEvent['action']): string {
    switch (action) {
      case 'CREATE':
        return EVENT_TYPES.TIME_OFF_CREATE;
      case 'DELETE':
        return EVENT_TYPES.TIME_OFF_DELETE;
      case 'UPDATE':
        return EVENT_TYPES.TIME_OFF_UPDATE;
      case 'STATUS_CHANGE':
        return EVENT_TYPES.TIME_OFF_STATUS_CHANGE;
      default:
        return 'timeoff.unknown';
    }
  }
  private formatDate(date: string | Date) {
    const dt = DateTime.fromJSDate(new Date(date)).toUTC();

    return {
      utc: dt.toFormat("yyyy-LL-dd HH:mm 'UTC'"),
      mountain: dt
        .setZone('America/Denver')
        .toFormat("yyyy-LL-dd hh:mm a 'MT'"),
    };
  }
}
