import { NotificationType } from './enums/notification-type.enum';
import {
  mapCommentCreated,
  mapCommentReplied,
  mapTaskAssigned,
  mapTaskCompleted,
} from './notification-mapping';

describe('notification-mapping', () => {
  it('maps task.assigned to the assignee', () => {
    expect(
      mapTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u2' }),
    ).toMatchObject({ recipientId: 'u2', type: NotificationType.TASK_ASSIGNED });
  });

  it('skips a self-assignment', () => {
    expect(
      mapTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u1' }),
    ).toBeNull();
  });

  it('maps task.completed to the creator (not the actor)', () => {
    expect(
      mapTaskCompleted({ taskId: 't', actorId: 'u2', creatorId: 'u1' }),
    ).toMatchObject({ recipientId: 'u1', type: NotificationType.TASK_COMPLETED });
  });

  it('maps a comment to the task assignee', () => {
    expect(
      mapCommentCreated({
        commentId: 'c',
        taskId: 't',
        authorId: 'u2',
        parentCommentId: null,
        taskAssigneeId: 'u1',
      }),
    ).toMatchObject({ recipientId: 'u1', type: NotificationType.COMMENT_ADDED });
  });

  it('skips a comment by the assignee themselves', () => {
    expect(
      mapCommentCreated({
        commentId: 'c',
        taskId: 't',
        authorId: 'u1',
        parentCommentId: null,
        taskAssigneeId: 'u1',
      }),
    ).toBeNull();
  });

  it('maps a reply to the parent comment author', () => {
    expect(
      mapCommentReplied({
        commentId: 'c',
        taskId: 't',
        parentCommentId: 'p',
        parentAuthorId: 'u1',
        authorId: 'u2',
      }),
    ).toMatchObject({ recipientId: 'u1', type: NotificationType.COMMENT_REPLY });
  });
});
