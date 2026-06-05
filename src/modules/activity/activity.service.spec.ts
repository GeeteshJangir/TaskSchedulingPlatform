import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from '../tasks/tasks.service';
import { ActivityService } from './activity.service';
import { TaskActivity } from './entities/task-activity.entity';
import { ActivityAction } from './enums/activity-action.enum';

describe('ActivityService', () => {
  let service: ActivityService;
  let repo: any;
  let tasks: { findOneOrFail: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'a1', ...x })),
      createQueryBuilder: jest.fn(),
    };
    tasks = { findOneOrFail: jest.fn().mockResolvedValue({ id: 't1' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getRepositoryToken(TaskActivity), useValue: repo },
        { provide: TasksService, useValue: tasks },
      ],
    }).compile();

    service = moduleRef.get(ActivityService);
  });

  it('record() persists an activity row with action + metadata', async () => {
    await service.record('t1', 'u1', ActivityAction.STATUS_CHANGED, {
      from: 'TODO',
      to: 'DONE',
    });
    expect(repo.create).toHaveBeenCalledWith({
      taskId: 't1',
      actorId: 'u1',
      action: ActivityAction.STATUS_CHANGED,
      metadata: { from: 'TODO', to: 'DONE' },
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('listForTask() validates the task and returns a keyset page', async () => {
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

    const page = await service.listForTask('w1', 'p1', 't1', { limit: 2 });
    expect(tasks.findOneOrFail).toHaveBeenCalledWith('w1', 'p1', 't1');
    expect(page.data).toHaveLength(2);
    expect(page.meta.hasMore).toBe(true);
  });
});
