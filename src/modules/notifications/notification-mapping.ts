import {
  CommentCreatedEvent,
  CommentRepliedEvent,
} from '../comments/events/comment-events';
import {
  TaskAssignedEvent,
  TaskCompletedEvent,
} from '../tasks/events/task-events';
import { NotificationType } from './enums/notification-type.enum';
import { CreateNotificationInput } from './notifications.service';

/**
 * Pure event -> notification mappers, shared by the in-process listener and the
 * queue listener. Returns null when no notification is warranted (self-action
 * or missing recipient).
 */

export function mapTaskAssigned(
  e: TaskAssignedEvent,
): CreateNotificationInput | null {
  if (!e.assigneeId || e.assigneeId === e.actorId) return null;
  return {
    recipientId: e.assigneeId,
    type: NotificationType.TASK_ASSIGNED,
    title: 'You were assigned a task',
    entityType: 'task',
    entityId: e.taskId,
  };
}

export function mapTaskCompleted(
  e: TaskCompletedEvent,
): CreateNotificationInput | null {
  if (!e.creatorId || e.creatorId === e.actorId) return null;
  return {
    recipientId: e.creatorId,
    type: NotificationType.TASK_COMPLETED,
    title: 'A task you created was completed',
    entityType: 'task',
    entityId: e.taskId,
  };
}

export function mapCommentCreated(
  e: CommentCreatedEvent,
): CreateNotificationInput | null {
  if (!e.taskAssigneeId || e.taskAssigneeId === e.authorId) return null;
  return {
    recipientId: e.taskAssigneeId,
    type: NotificationType.COMMENT_ADDED,
    title: 'New comment on your task',
    entityType: 'task',
    entityId: e.taskId,
  };
}

export function mapCommentReplied(
  e: CommentRepliedEvent,
): CreateNotificationInput | null {
  if (!e.parentAuthorId || e.parentAuthorId === e.authorId) return null;
  return {
    recipientId: e.parentAuthorId,
    type: NotificationType.COMMENT_REPLY,
    title: 'Someone replied to your comment',
    entityType: 'comment',
    entityId: e.commentId,
  };
}
