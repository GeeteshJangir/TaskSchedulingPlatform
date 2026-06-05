import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/entities/task.entity';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Reminder } from './entities/reminder.entity';
import { ReminderStatus } from './enums/reminder-status.enum';
import { ReminderType } from './enums/reminder-type.enum';

/** Look-ahead window for "due soon" reminders. */
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export interface ScanResult {
  scannedDueSoon: number;
  scannedOverdue: number;
  created: number;
  delivered: number;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Scans open tasks for upcoming/overdue due dates and dispatches reminders.
   * Idempotent: the UNIQUE(task_id,type,scheduled_for) constraint means only
   * newly-created reminders are delivered, however often the scan runs.
   */
  async scan(now: Date = new Date()): Promise<ScanResult> {
    const soonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

    const dueSoon = await this.openTasks()
      .andWhere('t.due_date > :now AND t.due_date <= :soon', { now, soon: soonCutoff })
      .getMany();

    const overdue = await this.openTasks()
      .andWhere('t.due_date <= :now', { now })
      .getMany();

    let created = 0;
    let delivered = 0;
    for (const task of dueSoon) {
      const outcome = await this.dispatch(task, ReminderType.DUE_SOON);
      if (outcome.created) created++;
      if (outcome.delivered) delivered++;
    }
    for (const task of overdue) {
      const outcome = await this.dispatch(task, ReminderType.OVERDUE);
      if (outcome.created) created++;
      if (outcome.delivered) delivered++;
    }

    this.logger.log(
      `Reminder scan: dueSoon=${dueSoon.length} overdue=${overdue.length} created=${created} delivered=${delivered}`,
    );
    return {
      scannedDueSoon: dueSoon.length,
      scannedOverdue: overdue.length,
      created,
      delivered,
    };
  }

  private openTasks() {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.due_date IS NOT NULL')
      .andWhere("t.status NOT IN ('DONE', 'CANCELLED')");
  }

  /**
   * Creates the reminder idempotently; only a brand-new row is delivered.
   * In-process delivery (Module 1): create the notification, mark SENT.
   * The queue-based path with retry/DLQ arrives in Module 2.
   */
  private async dispatch(
    task: Task,
    type: ReminderType,
  ): Promise<{ created: boolean; delivered: boolean }> {
    const reminderId = await this.createReminder(task.id, type, task.dueDate!);
    if (!reminderId) {
      return { created: false, delivered: false };
    }

    if (task.assigneeId) {
      await this.notifications.create({
        recipientId: task.assigneeId,
        type:
          type === ReminderType.DUE_SOON
            ? NotificationType.TASK_DUE_SOON
            : NotificationType.TASK_OVERDUE,
        title:
          type === ReminderType.DUE_SOON
            ? 'A task is due soon'
            : 'A task is overdue',
        entityType: 'task',
        entityId: task.id,
      });
    }

    await this.reminders.update(reminderId, {
      status: ReminderStatus.SENT,
      sentAt: new Date(),
    });
    return { created: true, delivered: true };
  }

  /** Inserts a reminder, ignoring the unique conflict. Returns the new id, or null if it already existed. */
  private async createReminder(
    taskId: string,
    type: ReminderType,
    scheduledFor: Date,
  ): Promise<string | null> {
    const result = await this.reminders
      .createQueryBuilder()
      .insert()
      .into(Reminder)
      .values({ taskId, type, scheduledFor, status: ReminderStatus.PENDING })
      .orIgnore()
      .returning('id')
      .execute();
    const id = result.raw?.[0]?.id as string | undefined;
    return id ?? null;
  }
}
