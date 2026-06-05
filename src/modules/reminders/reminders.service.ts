import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { NotificationType } from '../notifications/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Task } from '../tasks/entities/task.entity';
import { Reminder } from './entities/reminder.entity';
import { ReminderStatus } from './enums/reminder-status.enum';
import { ReminderType } from './enums/reminder-type.enum';
import {
  REMINDERS_QUEUE,
  SEND_REMINDER_JOB,
} from './reminders.constants';

/** Look-ahead window for "due soon" reminders. */
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export interface ScanResult {
  scannedDueSoon: number;
  scannedOverdue: number;
  created: number;
  delivered: number;
  enqueued: number;
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
    // Present only when QUEUE_ENABLED=true; otherwise delivery is in-process.
    @Optional()
    @InjectQueue(REMINDERS_QUEUE)
    private readonly queue?: Queue,
  ) {}

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
    let enqueued = 0;
    const tally = (o: {
      created: boolean;
      delivered: boolean;
      enqueued: boolean;
    }) => {
      if (o.created) created++;
      if (o.delivered) delivered++;
      if (o.enqueued) enqueued++;
    };
    for (const task of dueSoon) {
      tally(await this.dispatch(task, ReminderType.DUE_SOON));
    }
    for (const task of overdue) {
      tally(await this.dispatch(task, ReminderType.OVERDUE));
    }

    this.logger.log(
      `Reminder scan: dueSoon=${dueSoon.length} overdue=${overdue.length} created=${created} delivered=${delivered} enqueued=${enqueued}`,
    );
    return {
      scannedDueSoon: dueSoon.length,
      scannedOverdue: overdue.length,
      created,
      delivered,
      enqueued,
    };
  }

  /** Delivers a single reminder by id — called by the queue worker (Module 2). */
  async deliverReminder(reminderId: string): Promise<void> {
    const reminder = await this.reminders.findOne({ where: { id: reminderId } });
    if (!reminder || reminder.status === ReminderStatus.SENT) {
      return; // idempotent: already delivered (or gone)
    }
    const task = await this.tasks.findOne({ where: { id: reminder.taskId } });
    if (task?.assigneeId) {
      await this.notifyAssignee(task.id, task.assigneeId, reminder.type);
    }
    await this.reminders.update(reminder.id, {
      status: ReminderStatus.SENT,
      sentAt: new Date(),
      attempts: reminder.attempts + 1,
    });
  }

  /** Marks a reminder FAILED after the queue exhausts its retries. */
  async markFailed(reminderId: string, attempts: number): Promise<void> {
    await this.reminders.update(reminderId, {
      status: ReminderStatus.FAILED,
      attempts,
    });
  }

  private openTasks() {
    return this.tasks
      .createQueryBuilder('t')
      .where('t.due_date IS NOT NULL')
      .andWhere("t.status NOT IN ('DONE', 'CANCELLED')");
  }

  private async dispatch(
    task: Task,
    type: ReminderType,
  ): Promise<{ created: boolean; delivered: boolean; enqueued: boolean }> {
    const reminderId = await this.createReminder(task.id, type, task.dueDate!);
    if (!reminderId) {
      return { created: false, delivered: false, enqueued: false };
    }

    // QUEUE_ENABLED → durable async delivery (retry/DLQ in the worker).
    if (this.queue) {
      await this.queue.add(
        SEND_REMINDER_JOB,
        { reminderId },
        {
          jobId: reminderId, // idempotent: one job per reminder
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: false, // dead-letter set
        },
      );
      return { created: true, delivered: false, enqueued: true };
    }

    // In-process delivery (Module 1 path).
    if (task.assigneeId) {
      await this.notifyAssignee(task.id, task.assigneeId, type);
    }
    await this.reminders.update(reminderId, {
      status: ReminderStatus.SENT,
      sentAt: new Date(),
    });
    return { created: true, delivered: true, enqueued: false };
  }

  private notifyAssignee(
    taskId: string,
    assigneeId: string,
    type: ReminderType,
  ): Promise<unknown> {
    return this.notifications.create({
      recipientId: assigneeId,
      type:
        type === ReminderType.DUE_SOON
          ? NotificationType.TASK_DUE_SOON
          : NotificationType.TASK_OVERDUE,
      title:
        type === ReminderType.DUE_SOON
          ? 'A task is due soon'
          : 'A task is overdue',
      entityType: 'task',
      entityId: taskId,
    });
  }

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
