import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';
import { Notification } from '../notifications/entities/notification.entity';
import { NOTIFICATION_CREATED } from '../notifications/notification.constants';
import { REALTIME_NOTIFICATION_CHANNEL } from './realtime.constants';

/**
 * Worker-side half of the cluster bridge: when a notification is created off the
 * API process (the BullMQ worker), publish it to Redis so every API instance
 * can push it to its connected sockets. Registered only with
 * QUEUE_ENABLED + REDIS_URL in worker mode.
 */
@Injectable()
export class RealtimePublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimePublisher.name);
  private redis?: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('queue.redisUrl') ?? process.env.REDIS_URL;
    this.redis = url
      ? new Redis(url)
      : new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        });
    this.logger.log('Realtime publisher connected to Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit();
  }

  @OnEvent(NOTIFICATION_CREATED)
  publish(notification: Notification): void {
    void this.redis?.publish(
      REALTIME_NOTIFICATION_CHANNEL,
      JSON.stringify(notification),
    );
  }
}
