import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Notification } from '../notifications/entities/notification.entity';
import { NOTIFICATION_CREATED } from '../notifications/notification.constants';

/**
 * Pushes notifications to connected clients in real time. Clients authenticate
 * during the handshake (auth.token or ?token) and are placed in a per-user room;
 * a `notification.created` event then fans out to that user's sockets.
 */
@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token ?? '', {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
      client.data.userId = payload.sub;
      await client.join(this.room(payload.sub));
      this.logger.log(`Socket ${client.id} authenticated as ${payload.sub}`);
    } catch {
      client.emit('unauthorized', { message: 'Invalid or missing token' });
      client.disconnect(true);
    }
  }

  @OnEvent(NOTIFICATION_CREATED)
  pushNotification(notification: Notification): void {
    // No WS server attached (e.g. during e2e/worker) → nothing to push.
    if (!this.server) return;
    this.server.to(this.room(notification.recipientId)).emit('notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: notification.createdAt,
    });
  }

  private room(userId: string): string {
    return `user:${userId}`;
  }
}
