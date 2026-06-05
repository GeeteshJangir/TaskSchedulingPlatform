import { NotificationListener } from './notification.listener';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './enums/notification-type.enum';

describe('NotificationListener', () => {
  let listener: NotificationListener;
  let notifications: { create: jest.Mock };

  beforeEach(() => {
    notifications = { create: jest.fn() };
    listener = new NotificationListener(
      notifications as unknown as NotificationsService,
    );
  });

  it('notifies the assignee on task.assigned', async () => {
    await listener.onTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u2' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u2',
        type: NotificationType.TASK_ASSIGNED,
      }),
    );
  });

  it('does NOT notify when you assign a task to yourself', async () => {
    await listener.onTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u1' });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('notifies the creator on task.completed (not the actor)', async () => {
    await listener.onTaskCompleted({ taskId: 't', actorId: 'u2', creatorId: 'u1' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u1',
        type: NotificationType.TASK_COMPLETED,
      }),
    );
  });

  it('notifies the task assignee on a comment (COMMENT_ADDED)', async () => {
    await listener.onComment({
      commentId: 'c',
      taskId: 't',
      authorId: 'u2',
      parentCommentId: null,
      taskAssigneeId: 'u1',
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u1',
        type: NotificationType.COMMENT_ADDED,
      }),
    );
  });

  it('notifies the parent author on a reply (COMMENT_REPLY)', async () => {
    await listener.onReply({
      commentId: 'c',
      taskId: 't',
      parentCommentId: 'p',
      parentAuthorId: 'u1',
      authorId: 'u2',
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'u1',
        type: NotificationType.COMMENT_REPLY,
      }),
    );
  });
});
