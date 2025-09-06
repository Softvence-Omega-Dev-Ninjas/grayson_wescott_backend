import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { EVENT_TYPES } from '@project/common/interface/events-name';
import { AnnouncementEvent } from '@project/common/interface/events-payload';
import { QueueName } from '@project/common/interface/queue-name';
import { MailService } from '@project/lib/mail/mail.service';
import { NotificationGateway } from '@project/lib/notification/notification.gateway';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { Worker } from 'bullmq';

@Injectable()
export class CompanyAnnouncementWorker implements OnModuleInit {
  private readonly logger = new Logger(CompanyAnnouncementWorker.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly gateway: NotificationGateway,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    new Worker<AnnouncementEvent>(
      QueueName.ANNOUNCEMENT,
      async (job) => {
        if (job.name !== EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE) return;

        const {
          info: { title, message, recipients, sendEmail },
          meta,
        } = job.data;

        // * Send email notifications
        if (sendEmail) {
          for (const recipient of recipients) {
            const email = recipient.email;
            try {
              await this.mailService.sendEmail(
                email,
                title,
                `<h3>${title}</h3><p>${message}</p>`,
              );
              this.logger.log(`Email sent: ${email}`);
            } catch (err) {
              this.logger.error(`Email failed: ${email}`, err);
            }
          }
        }

        // * Send Socket notifications
        this.gateway.notifyMultipleUsers(
          recipients.map((r) => r.id),
          EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE,
          {
            type: EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE,
            title,
            message,
            createdAt: new Date(),
            meta,
          },
        );

        // * Store in database
        await this.prisma.notification.create({
          data: {
            title,
            message,
            type: 'Announcement',
            meta: {
              ...meta,
            },
            users: {
              createMany: {
                data: recipients.map((r) => ({
                  userId: r.id,
                  read: false,
                })),
              },
            },
          },
        });
      },
      {
        connection: {
          host: this.config.get(ENVEnum.REDIS_HOST),
          port: +this.config.get(ENVEnum.REDIS_PORT),
        },
      },
    );
  }
}
