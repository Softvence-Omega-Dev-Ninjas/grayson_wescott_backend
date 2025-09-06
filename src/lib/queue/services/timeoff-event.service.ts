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
export class TimeoffEventService {
  constructor(
    @InjectQueue(QueueName.TIME_OFF)
    private readonly notificationQueue: Queue,
    private readonly gateway: NotificationGateway,
  ) {}

  /**
   * Handles time off creation events.
   */
  @OnEvent(EVENT_TYPES.TIME_OFF_CREATE)
  async handleCreateTimeOff(
    payload: EventPayloadMap[typeof EVENT_TYPES.TIME_OFF_CREATE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.TIME_OFF_CREATE, payload);
  }

  /**
   * Handles time off update events.
   */
  @OnEvent(EVENT_TYPES.TIME_OFF_UPDATE)
  async handleUpdateTimeOff(
    payload: EventPayloadMap[typeof EVENT_TYPES.TIME_OFF_UPDATE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.TIME_OFF_UPDATE, payload);
  }

  /**
   * Handles time off deletion events.
   */
  @OnEvent(EVENT_TYPES.TIME_OFF_DELETE)
  async handleDeleteTimeOff(
    payload: EventPayloadMap[typeof EVENT_TYPES.TIME_OFF_DELETE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.TIME_OFF_DELETE, payload);
  }

  /**
   * Handles time off status change events.
   */
  @OnEvent(EVENT_TYPES.TIME_OFF_STATUS_CHANGE)
  async handleStatusChangeTimeOff(
    payload: EventPayloadMap[typeof EVENT_TYPES.TIME_OFF_STATUS_CHANGE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(
      EVENT_TYPES.TIME_OFF_STATUS_CHANGE,
      payload,
    );
  }
}
