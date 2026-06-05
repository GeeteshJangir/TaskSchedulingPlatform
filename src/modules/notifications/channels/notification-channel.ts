import { CreateNotificationInput } from '../notifications.service';

/** DI token for the list of active notification channels. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

/**
 * A delivery channel for a notification. The worker dispatches each job to every
 * registered channel — new channels (email, push, realtime) plug in here.
 */
export interface NotificationChannel {
  readonly name: string;
  deliver(input: CreateNotificationInput): Promise<void>;
}
