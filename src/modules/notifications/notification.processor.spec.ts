import { Job } from 'bullmq';
import { NotificationChannel } from './channels/notification-channel';
import { NotificationProcessor } from './notification.processor';

describe('NotificationProcessor', () => {
  it('fans a job out to every channel', async () => {
    const inApp = { name: 'in-app', deliver: jest.fn() };
    const email = { name: 'email', deliver: jest.fn() };
    const processor = new NotificationProcessor([
      inApp,
      email,
    ] as unknown as NotificationChannel[]);

    const job = {
      id: 'j1',
      data: { recipientId: 'u1', type: 'TASK_ASSIGNED', title: 'hi' },
    } as unknown as Job;

    await processor.process(job);

    expect(inApp.deliver).toHaveBeenCalledWith(job.data);
    expect(email.deliver).toHaveBeenCalledWith(job.data);
  });
});
