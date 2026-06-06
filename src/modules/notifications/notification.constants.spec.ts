import { NotificationType } from './enums/notification-type.enum';
import { notificationJobId } from './notification.constants';
import { CreateNotificationInput } from './notifications.service';

describe('notificationJobId', () => {
  const input: CreateNotificationInput = {
    recipientId: 'u1',
    type: NotificationType.TASK_ASSIGNED,
    title: 'x',
    entityId: 'e1',
  };

  it('contains no ":" (BullMQ forbids it in custom job ids)', () => {
    expect(notificationJobId(input)).not.toContain(':');
  });

  it('is deterministic for the same recipient/type/entity (idempotency key)', () => {
    expect(notificationJobId(input)).toBe(notificationJobId(input));
  });
});
