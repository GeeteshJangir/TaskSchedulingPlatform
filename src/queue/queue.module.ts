import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Parses a redis:// or rediss:// URL into BullMQ/ioredis connection options. */
function connectionFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || '6379'),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    // rediss:// → TLS (e.g. Upstash). Empty object = TLS with defaults.
    tls: u.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Configures the BullMQ Redis connection — only when QUEUE_ENABLED=true, so the
 * app boots fine without Redis (in-process delivery handles notifications then).
 * Accepts a single REDIS_URL (e.g. Upstash rediss://) or discrete host/port.
 */
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    if (process.env.QUEUE_ENABLED !== 'true') {
      return { module: QueueModule };
    }
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const url = config.get<string>('queue.redisUrl');
            return {
              connection: url
                ? connectionFromUrl(url)
                : {
                    host: config.get<string>('redis.host'),
                    port: config.get<number>('redis.port'),
                    maxRetriesPerRequest: null,
                  },
            };
          },
        }),
      ],
      exports: [BullModule],
    };
  }
}
