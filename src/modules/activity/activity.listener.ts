import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  COMMENT_CREATED,
  CommentCreatedEvent,
} from '../comments/events/comment-events';
import {
  TASK_ASSIGNED,
  TASK_COMPLETED,
  TASK_CREATED,
  TASK_STATUS_CHANGED,
  TaskAssignedEvent,
  TaskCompletedEvent,
  TaskCreatedEvent,
  TaskStatusChangedEvent,
} from '../tasks/events/task-events';
import { ActivityService } from './activity.service';
import { ActivityAction } from './enums/activity-action.enum';

/**
 * Turns domain events into audit-trail rows. In-process (synchronous emit);
 * best-effort. Notification delivery moves to a durable queue in Phase 6.
 *
 * Note: COMMENT_REPLIED is intentionally NOT handled here — COMMENT_CREATED
 * already carries parentCommentId, so one row per comment (COMMENTED vs
 * REPLIED). COMMENT_REPLIED is for notification targeting only.
 */
@Injectable()
export class ActivityListener {
  constructor(private readonly activity: ActivityService) {}

  @OnEvent(TASK_CREATED)
  onTaskCreated(e: TaskCreatedEvent): Promise<void> {
    return this.activity.record(e.taskId, e.actorId, ActivityAction.CREATED, {
      projectId: e.projectId,
    });
  }

  @OnEvent(TASK_ASSIGNED)
  onTaskAssigned(e: TaskAssignedEvent): Promise<void> {
    return this.activity.record(e.taskId, e.actorId, ActivityAction.ASSIGNED, {
      assigneeId: e.assigneeId,
    });
  }

  @OnEvent(TASK_STATUS_CHANGED)
  onTaskStatusChanged(e: TaskStatusChangedEvent): Promise<void> {
    return this.activity.record(
      e.taskId,
      e.actorId,
      ActivityAction.STATUS_CHANGED,
      { from: e.from, to: e.to },
    );
  }

  @OnEvent(TASK_COMPLETED)
  onTaskCompleted(e: TaskCompletedEvent): Promise<void> {
    return this.activity.record(e.taskId, e.actorId, ActivityAction.COMPLETED);
  }

  @OnEvent(COMMENT_CREATED)
  onCommentCreated(e: CommentCreatedEvent): Promise<void> {
    const action = e.parentCommentId
      ? ActivityAction.REPLIED
      : ActivityAction.COMMENTED;
    return this.activity.record(e.taskId, e.authorId, action, {
      commentId: e.commentId,
      ...(e.parentCommentId ? { parentCommentId: e.parentCommentId } : {}),
    });
  }
}
