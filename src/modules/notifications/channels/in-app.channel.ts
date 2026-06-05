import { Injectable } from '@nestjs/common';
import {
  CreateNotificationInput,
  NotificationsService,
} from '../notifications.service';
import { NotificationChannel } from './notification-channel';

/** Persists the notification to the per-user inbox (the in-app channel). */
@Injectable()
export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';

  constructor(private readonly notifications: NotificationsService) {}

  async deliver(input: CreateNotificationInput): Promise<void> {
    await this.notifications.create(input);
  }
}
