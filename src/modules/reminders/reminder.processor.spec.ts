import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { RemindersService } from './reminders.service';

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let reminders: { deliverReminder: jest.Mock; markFailed: jest.Mock };

  beforeEach(() => {
    reminders = { deliverReminder: jest.fn(), markFailed: jest.fn() };
    processor = new ReminderProcessor(
      reminders as unknown as RemindersService,
    );
  });

  it('process() delegates delivery to the service', async () => {
    await processor.process({ data: { reminderId: 'r1' }, id: 'j1' } as unknown as Job);
    expect(reminders.deliverReminder).toHaveBeenCalledWith('r1');
  });

  it('onFailed() marks the reminder FAILED once retries are exhausted', async () => {
    const job = {
      data: { reminderId: 'r1' },
      opts: { attempts: 5 },
      attemptsMade: 5,
    } as unknown as Job;
    await processor.onFailed(job, new Error('boom'));
    expect(reminders.markFailed).toHaveBeenCalledWith('r1', 5);
  });

  it('onFailed() does NOT mark FAILED while retries remain', async () => {
    const job = {
      data: { reminderId: 'r1' },
      opts: { attempts: 5 },
      attemptsMade: 2,
    } as unknown as Job;
    await processor.onFailed(job, new Error('transient'));
    expect(reminders.markFailed).not.toHaveBeenCalled();
  });
});
