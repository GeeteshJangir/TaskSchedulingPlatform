import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification } from '../notifications/entities/notification.entity';
import { NOTIFICATION_CREATED } from '../notifications/notification.constants';
import { REALTIME_NOTIFICATION_CHANNEL } from './realtime.constants';
import { RealtimePublisher } from './realtime.publisher';
import { RealtimeSubscriber } from './realtime.subscriber';

const config = { get: () => undefined } as unknown as ConfigService;

describe('Realtime cluster bridge', () => {
  it('publisher → publishes the notification to the Redis channel', () => {
    const publisher = new RealtimePublisher(config);
    const redis = { publish: jest.fn() };
    (publisher as unknown as { redis: unknown }).redis = redis;

    const notification = { id: 'n1', recipientId: 'u1' } as Notification;
    publisher.publish(notification);

    expect(redis.publish).toHaveBeenCalledWith(
      REALTIME_NOTIFICATION_CHANNEL,
      JSON.stringify(notification),
    );
  });

  it('subscriber → re-emits notification.created from an inbound message', () => {
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const subscriber = new RealtimeSubscriber(config, events);
    const payload = { id: 'n1', recipientId: 'u1' };

    subscriber.handleMessage(JSON.stringify(payload));

    expect(events.emit).toHaveBeenCalledWith(NOTIFICATION_CREATED, payload);
  });

  it('subscriber → ignores malformed messages', () => {
    const events = { emit: jest.fn() } as unknown as EventEmitter2;
    const subscriber = new RealtimeSubscriber(config, events);

    subscriber.handleMessage('not-json');

    expect(events.emit).not.toHaveBeenCalled();
  });
});
