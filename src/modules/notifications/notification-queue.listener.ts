import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
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
  DELIVER_JOB,
  NOTIFICATIONS_QUEUE,
  notificationJobId,
} from './notification.constants';
import {
  mapCommentCreated,
  mapCommentReplied,
  mapTaskAssigned,
  mapTaskCompleted,
} from './notification-mapping';
import { CreateNotificationInput } from './notifications.service';

/**
 * Queue delivery path (QUEUE_ENABLED=true, API process): translates domain
 * events into durable jobs with idempotent ids, retries, and exponential
 * backoff. The worker process consumes them (NotificationProcessor).
 */
@Injectable()
export class NotificationQueueListener {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  @OnEvent(TASK_ASSIGNED)
  onTaskAssigned(e: TaskAssignedEvent) {
    return this.enqueue(mapTaskAssigned(e));
  }

  @OnEvent(TASK_COMPLETED)
  onTaskCompleted(e: TaskCompletedEvent) {
    return this.enqueue(mapTaskCompleted(e));
  }

  @OnEvent(COMMENT_CREATED)
  onComment(e: CommentCreatedEvent) {
    return this.enqueue(mapCommentCreated(e));
  }

  @OnEvent(COMMENT_REPLIED)
  onReply(e: CommentRepliedEvent) {
    return this.enqueue(mapCommentReplied(e));
  }

  private enqueue(input: CreateNotificationInput | null) {
    if (!input) return Promise.resolve(undefined);
    return this.queue.add(DELIVER_JOB, input, {
      jobId: notificationJobId(input),
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      // Keep failed jobs as a dead-letter set for inspection / replay.
      removeOnFail: false,
    });
  }
}
