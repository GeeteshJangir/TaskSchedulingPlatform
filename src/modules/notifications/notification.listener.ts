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
import {
  mapCommentCreated,
  mapCommentReplied,
  mapTaskAssigned,
  mapTaskCompleted,
} from './notification-mapping';
import {
  CreateNotificationInput,
  NotificationsService,
} from './notifications.service';

/**
 * In-process delivery path (QUEUE_ENABLED=false): creates the notification
 * synchronously from the domain event. Shares the mappers with the queue path.
 */
@Injectable()
export class NotificationListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(TASK_ASSIGNED)
  onTaskAssigned(e: TaskAssignedEvent) {
    return this.deliver(mapTaskAssigned(e));
  }

  @OnEvent(TASK_COMPLETED)
  onTaskCompleted(e: TaskCompletedEvent) {
    return this.deliver(mapTaskCompleted(e));
  }

  @OnEvent(COMMENT_CREATED)
  onComment(e: CommentCreatedEvent) {
    return this.deliver(mapCommentCreated(e));
  }

  @OnEvent(COMMENT_REPLIED)
  onReply(e: CommentRepliedEvent) {
    return this.deliver(mapCommentReplied(e));
  }

  private deliver(input: CreateNotificationInput | null) {
    return input ? this.notifications.create(input) : Promise.resolve();
  }
}
