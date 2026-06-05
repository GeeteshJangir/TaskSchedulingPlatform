import { CreateNotificationInput } from './notifications.service';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const DELIVER_JOB = 'deliver';

/**
 * Deterministic job id so BullMQ dedupes duplicate notifications for the same
 * recipient/type/entity (idempotency at the queue layer).
 */
export function notificationJobId(input: CreateNotificationInput): string {
  return `notif:${input.recipientId}:${input.type}:${input.entityId ?? 'none'}`;
}
