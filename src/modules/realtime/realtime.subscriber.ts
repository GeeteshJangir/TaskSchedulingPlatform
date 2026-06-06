import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';
import { NOTIFICATION_CREATED } from '../notifications/notification.constants';
import { REALTIME_NOTIFICATION_CHANNEL } from './realtime.constants';

/**
 * API-side half of the cluster bridge: subscribe to Redis and re-emit
 * notification.created locally, so this instance's gateway pushes it to the
 * sockets it holds. Registered only with QUEUE_ENABLED + REDIS_URL in API mode.
 */
@Injectable()
export class RealtimeSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeSubscriber.name);
  private redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    const url =
      this.config.get<string>('queue.redisUrl') ?? process.env.REDIS_URL;
    this.redis = url
      ? new Redis(url)
      : new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        });
    await this.redis.subscribe(REALTIME_NOTIFICATION_CHANNEL);
    this.redis.on('message', (_channel, message) =>
      this.handleMessage(message),
    );
    this.logger.log('Realtime subscriber listening on Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  /** Re-emits an inbound notification locally so the gateway pushes it. */
  handleMessage(message: string): void {
    try {
      this.events.emit(NOTIFICATION_CREATED, JSON.parse(message));
    } catch (err) {
      this.logger.warn(`Discarded malformed realtime message: ${String(err)}`);
    }
  }
}
