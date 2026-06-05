import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RemindersService } from './reminders.service';
import {
  REMINDERS_QUEUE,
  SendReminderJob,
} from './reminders.constants';

/**
 * Worker that delivers reminders enqueued by the scan. BullMQ handles
 * retry/backoff (set at enqueue); on exhausted retries the reminder is marked
 * FAILED and the job stays in the dead-letter (failed) set.
 */
@Processor(REMINDERS_QUEUE, { concurrency: 5 })
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(private readonly reminders: RemindersService) {
    super();
  }

  async process(job: Job<SendReminderJob>): Promise<void> {
    await this.reminders.deliverReminder(job.data.reminderId);
    this.logger.log(`Delivered reminder ${job.data.reminderId} (job ${job.id})`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SendReminderJob>, err: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Reminder ${job.data.reminderId} failed after ${job.attemptsMade} attempts: ${err.message}`,
      );
      await this.reminders.markFailed(job.data.reminderId, job.attemptsMade);
    }
  }
}
