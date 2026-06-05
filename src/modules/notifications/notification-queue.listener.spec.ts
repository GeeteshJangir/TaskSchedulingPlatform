import { Queue } from 'bullmq';
import { DELIVER_JOB } from './notification.constants';
import { NotificationQueueListener } from './notification-queue.listener';

describe('NotificationQueueListener', () => {
  let listener: NotificationQueueListener;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn() };
    listener = new NotificationQueueListener(queue as unknown as Queue);
  });

  it('enqueues a deliver job with a dedup jobId, retries, and backoff', async () => {
    await listener.onTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u2' });
    expect(queue.add).toHaveBeenCalledWith(
      DELIVER_JOB,
      expect.objectContaining({ recipientId: 'u2' }),
      expect.objectContaining({
        jobId: expect.stringContaining('notif:u2:'),
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnFail: false,
      }),
    );
  });

  it('does not enqueue for a self-action', async () => {
    await listener.onTaskAssigned({ taskId: 't', actorId: 'u1', assigneeId: 'u1' });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
