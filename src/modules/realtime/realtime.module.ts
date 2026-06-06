import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsGateway } from './notifications.gateway';
import { RealtimePublisher } from './realtime.publisher';
import { RealtimeSubscriber } from './realtime.subscriber';

const queueEnabled = process.env.QUEUE_ENABLED === 'true';
const isWorker = process.env.RUN_MODE === 'worker';

// Cluster bridge — only with the durable queue (which implies Redis). The
// worker publishes created notifications to Redis; each API instance subscribes
// and re-emits locally so its gateway pushes to its own sockets. Single-instance
// dev (no queue) relies on the gateway's in-process listener instead.
const bridgeProviders = queueEnabled
  ? isWorker
    ? [RealtimePublisher]
    : [RealtimeSubscriber]
  : [];

@Module({
  imports: [
    // Verifies the access token during the WebSocket handshake.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  providers: [NotificationsGateway, ...bridgeProviders],
})
export class RealtimeModule {}
