import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  EVENT_TYPES,
  EventPayloadMap,
} from '@project/common/interface/events-name';
import { QueueName } from '@project/common/interface/queue-name';
import { NotificationGateway } from '@project/lib/notification/notification.gateway';
import { Queue } from 'bullmq';

@Injectable()
export class CompanyEventService {
  constructor(
    @InjectQueue(QueueName.ANNOUNCEMENT)
    private readonly notificationQueue: Queue,
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Handles announcement creation events.
   */
  @OnEvent(EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE)
  async handleCreateAnnouncement(
    payload: EventPayloadMap[typeof EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(
      EVENT_TYPES.COMPANY_ANNOUNCEMENT_CREATE,
      payload,
      { delay: this.gateway.getDelay(payload.meta.publishedAt) },
    );
  }
}
