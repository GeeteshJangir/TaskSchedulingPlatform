import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  Page,
} from '../../common/pagination/pagination.util';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { Notification } from './entities/notification.entity';
import { NOTIFICATION_CREATED } from './notification.constants';
import { NotificationType } from './enums/notification-type.enum';

export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  workspaceId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly events: EventEmitter2,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification = await this.notifications.save(
      this.notifications.create({
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        workspaceId: input.workspaceId ?? null,
        isRead: false,
      }),
    );
    // Fan out to the realtime gateway (and any other notification.created listener).
    this.events.emit(NOTIFICATION_CREATED, notification);
    return notification;
  }

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Page<Notification>> {
    const limit = query.limit ?? 20;
    const qb = this.notifications
      .createQueryBuilder('n')
      .where('n.recipient_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(limit + 1);

    if (query.unread) {
      qb.andWhere('n.is_read = false');
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(n.created_at, n.id) < (CAST(:cc AS timestamptz), CAST(:ci AS uuid))',
          { cc: decoded.createdAt, ci: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    return buildPage(rows, limit, (n) => encodeCursor(n.createdAt, n.id));
  }

  unreadCount(userId: string): Promise<number> {
    return this.notifications.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notifications.findOne({
      where: { id, recipientId: userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notifications.update(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
