import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InAppChannel } from './channels/in-app.channel';
import { NOTIFICATION_CHANNELS } from './channels/notification-channel';
import { Notification } from './entities/notification.entity';
import { NotificationListener } from './notification.listener';
import { NOTIFICATIONS_QUEUE } from './notification.constants';
import { NotificationProcessor } from './notification.processor';
import { NotificationQueueListener } from './notification-queue.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const queueEnabled = process.env.QUEUE_ENABLED === 'true';
const isWorker = process.env.RUN_MODE === 'worker';

// Delivery providers, selected at module-load time:
//  - queue + worker  -> NotificationProcessor (consumes jobs)
//  - queue + api     -> NotificationQueueListener (enqueues jobs)
//  - no queue        -> NotificationListener (in-process)
const deliveryProviders = queueEnabled
  ? isWorker
    ? [NotificationProcessor]
    : [NotificationQueueListener]
  : [NotificationListener];

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    ...(queueEnabled
      ? [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })]
      : []),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InAppChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (inApp: InAppChannel) => [inApp],
      inject: [InAppChannel],
    },
    ...deliveryProviders,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
