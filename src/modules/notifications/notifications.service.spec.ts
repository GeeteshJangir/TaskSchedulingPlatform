import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'n1', ...x })),
      findOne: jest.fn(),
      count: jest.fn(),
      update: jest.fn(async () => ({ affected: 3 })),
      createQueryBuilder: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  it('create() persists an unread notification', async () => {
    const n = await service.create({
      recipientId: 'u1',
      type: NotificationType.TASK_ASSIGNED,
      title: 'You were assigned a task',
      entityId: 't1',
      entityType: 'task',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 'u1', isRead: false }),
    );
    expect(n.id).toBe('n1');
  });

  it('unreadCount() counts unread for the user', async () => {
    repo.count.mockResolvedValue(5);
    await expect(service.unreadCount('u1')).resolves.toBe(5);
    expect(repo.count).toHaveBeenCalledWith({
      where: { recipientId: 'u1', isRead: false },
    });
  });

  it('markRead() 404s when not found / not the recipient', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markRead() sets is_read + read_at once', async () => {
    repo.findOne.mockResolvedValue({ id: 'n1', isRead: false });
    const n = await service.markRead('u1', 'n1');
    expect(n.isRead).toBe(true);
    expect(n.readAt).toBeInstanceOf(Date);
  });

  it('markAllRead() returns the affected count', async () => {
    await expect(service.markAllRead('u1')).resolves.toBe(3);
  });

  it('list() returns a keyset page', async () => {
    const rows = [
      { id: 'a', createdAt: new Date('2026-06-03T00:00:00Z') },
      { id: 'b', createdAt: new Date('2026-06-02T00:00:00Z') },
      { id: 'c', createdAt: new Date('2026-06-01T00:00:00Z') },
    ];
    const qb: Record<string, jest.Mock> = {
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getMany: jest.fn(async () => rows),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    const page = await service.list('u1', { limit: 2, unread: true });
    expect(page.data).toHaveLength(2);
    expect(page.meta.hasMore).toBe(true);
  });
});
