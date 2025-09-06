import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  EVENT_TYPES,
  EventPayloadMap,
} from '@project/common/interface/events-name';
import { QueueName } from '@project/common/interface/queue-name';
import { Queue } from 'bullmq';

@Injectable()
export class ShiftEventService {
  constructor(
    @InjectQueue(QueueName.SHIFT)
    private readonly notificationQueue: Queue,
  ) {}

  /**
   * Handles shift assignment events.
   */
  @OnEvent(EVENT_TYPES.SHIFT_ASSIGN)
  async handleShiftAssignment(
    payload: EventPayloadMap[typeof EVENT_TYPES.SHIFT_ASSIGN],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.SHIFT_ASSIGN, payload);
  }

  /**
   * Handles shift change events.
   */
  @OnEvent(EVENT_TYPES.SHIFT_CHANGE)
  async handleShiftChange(
    payload: EventPayloadMap[typeof EVENT_TYPES.SHIFT_CHANGE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.SHIFT_CHANGE, payload);
  }

  /**
   * Handles shift status update events.
   */
  @OnEvent(EVENT_TYPES.SHIFT_STATUS_UPDATE)
  async handleShiftCancellation(
    payload: EventPayloadMap[typeof EVENT_TYPES.SHIFT_STATUS_UPDATE],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.SHIFT_STATUS_UPDATE, payload);
  }

  /**
   * Handles urgent shift change events.
   */
  @OnEvent(EVENT_TYPES.URGENT_SHIFT_CHANGED)
  async handleUrgentShiftChange(
    payload: EventPayloadMap[typeof EVENT_TYPES.URGENT_SHIFT_CHANGED],
  ) {
    // Enqueue for processing by worker
    await this.notificationQueue.add(EVENT_TYPES.URGENT_SHIFT_CHANGED, payload);
  }
}
