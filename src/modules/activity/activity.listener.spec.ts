import { ActivityListener } from './activity.listener';
import { ActivityService } from './activity.service';
import { ActivityAction } from './enums/activity-action.enum';

describe('ActivityListener', () => {
  let listener: ActivityListener;
  let activity: { record: jest.Mock };

  beforeEach(() => {
    activity = { record: jest.fn() };
    listener = new ActivityListener(activity as unknown as ActivityService);
  });

  it('maps task.created -> CREATED', () => {
    listener.onTaskCreated({ taskId: 't', actorId: 'u', projectId: 'p' });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.CREATED, {
      projectId: 'p',
    });
  });

  it('maps task.assigned -> ASSIGNED', () => {
    listener.onTaskAssigned({ taskId: 't', actorId: 'u', assigneeId: 'a' });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.ASSIGNED, {
      assigneeId: 'a',
    });
  });

  it('maps task.status_changed -> STATUS_CHANGED with from/to', () => {
    listener.onTaskStatusChanged({ taskId: 't', actorId: 'u', from: 'TODO', to: 'DONE' });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.STATUS_CHANGED, {
      from: 'TODO',
      to: 'DONE',
    });
  });

  it('maps task.completed -> COMPLETED', () => {
    listener.onTaskCompleted({ taskId: 't', actorId: 'u' });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.COMPLETED);
  });

  it('maps a top-level comment -> COMMENTED', () => {
    listener.onCommentCreated({ commentId: 'c', taskId: 't', authorId: 'u', parentCommentId: null });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.COMMENTED, {
      commentId: 'c',
    });
  });

  it('maps a reply -> REPLIED with parentCommentId', () => {
    listener.onCommentCreated({ commentId: 'c', taskId: 't', authorId: 'u', parentCommentId: 'p' });
    expect(activity.record).toHaveBeenCalledWith('t', 'u', ActivityAction.REPLIED, {
      commentId: 'c',
      parentCommentId: 'p',
    });
  });
});
