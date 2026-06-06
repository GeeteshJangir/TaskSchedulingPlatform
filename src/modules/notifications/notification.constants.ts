import { CreateNotificationInput } from './notifications.service';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const DELIVER_JOB = 'deliver';

/** Emitted after a notification is persisted; the realtime gateway pushes it live. */
export const NOTIFICATION_CREATED = 'notification.created';

/**
 * Deterministic job id so BullMQ dedupes duplicate notifications for the same
 * recipient/type/entity (idempotency at the queue layer). BullMQ forbids ':'
 * in custom job ids, so fields are joined with '_'.
 */
export function notificationJobId(input: CreateNotificationInput): string {
  return `notif_${input.recipientId}_${input.type}_${input.entityId ?? 'none'}`;
}
