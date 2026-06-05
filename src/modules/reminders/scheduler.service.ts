import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from './reminders.service';

/**
 * Cron driver for the reminder scan. Registered only in the worker process
 * (RUN_MODE=worker) so the schedule runs once, independent of API replicas.
 * A guard prevents overlapping runs if a scan exceeds the interval.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private running = false;

  constructor(private readonly reminders: RemindersService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'reminder-scan' })
  async handleReminderScan(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous reminder scan still running; skipping this tick');
      return;
    }
    this.running = true;
    try {
      await this.reminders.scan();
    } catch (err) {
      this.logger.error('Reminder scan failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
