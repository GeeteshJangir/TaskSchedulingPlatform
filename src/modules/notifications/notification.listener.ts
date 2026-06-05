import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_CREATED,
  COMMENT_REPLIED,
  CommentCreatedEvent,
  CommentRepliedEvent,
} from '../comments/events/comment-events';
import {
  TASK_ASSIGNED,
  TASK_COMPLETED,
  TaskAssignedEvent,
  TaskCompletedEvent,
} from '../tasks/events/task-events';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './enums/notification-type.enum';

/**
 * Phase 5-style in-process delivery of notifications from domain events.
 * Self-notifications are skipped (you don't get pinged for your own action).
 * Phase 6.2 moves this onto a durable BullMQ queue (retry, DLQ, idempotency).
 */
@Injectable()
export class NotificationListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(TASK_ASSIGNED)
  async onTaskAssigned(e: TaskAssignedEvent): Promise<void> {
    if (!e.assigneeId || e.assigneeId === e.actorId) return;
    await this.notifications.create({
      recipientId: e.assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      title: 'You were assigned a task',
      entityType: 'task',
      entityId: e.taskId,
    });
  }

  @OnEvent(TASK_COMPLETED)
  async onTaskCompleted(e: TaskCompletedEvent): Promise<void> {
    if (!e.creatorId || e.creatorId === e.actorId) return;
    await this.notifications.create({
      recipientId: e.creatorId,
      type: NotificationType.TASK_COMPLETED,
      title: 'A task you created was completed',
      entityType: 'task',
      entityId: e.taskId,
    });
  }

  @OnEvent(COMMENT_CREATED)
  async onComment(e: CommentCreatedEvent): Promise<void> {
    if (!e.taskAssigneeId || e.taskAssigneeId === e.authorId) return;
    await this.notifications.create({
      recipientId: e.taskAssigneeId,
      type: NotificationType.COMMENT_ADDED,
      title: 'New comment on your task',
      entityType: 'task',
      entityId: e.taskId,
    });
  }

  @OnEvent(COMMENT_REPLIED)
  async onReply(e: CommentRepliedEvent): Promise<void> {
    if (!e.parentAuthorId || e.parentAuthorId === e.authorId) return;
    await this.notifications.create({
      recipientId: e.parentAuthorId,
      type: NotificationType.COMMENT_REPLY,
      title: 'Someone replied to your comment',
      entityType: 'comment',
      entityId: e.commentId,
    });
  }
}
