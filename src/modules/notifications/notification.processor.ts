import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
} from './channels/notification-channel';
import { NOTIFICATIONS_QUEUE } from './notification.constants';
import { CreateNotificationInput } from './notifications.service';

/**
 * Worker that consumes notification jobs and fans them out to every channel.
 * Runs in the worker process (RUN_MODE=worker). BullMQ handles retry/backoff
 * (set at enqueue) and keeps failed jobs as a dead-letter set.
 */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {
    super();
  }

  async process(job: Job<CreateNotificationInput>): Promise<void> {
    for (const channel of this.channels) {
      await channel.deliver(job.data);
    }
    this.logger.log(
      `Delivered notification job ${job.id} via ${this.channels.length} channel(s)`,
    );
  }
}
