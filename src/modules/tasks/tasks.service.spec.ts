import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectsService } from '../projects/projects.service';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { TasksService } from './tasks.service';
import {
  TASK_ASSIGNED,
  TASK_COMPLETED,
  TASK_CREATED,
  TASK_STATUS_CHANGED,
} from './events/task-events';

describe('TasksService', () => {
  let service: TasksService;
  let repo: any;
  let projects: { findOneOrFail: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? 'task1', ...x })),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    projects = { findOneOrFail: jest.fn().mockResolvedValue({ id: 'p1' }) };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: repo },
        { provide: ProjectsService, useValue: projects },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('create() emits task.created (and task.assigned when assigned)', async () => {
    await service.create('w1', 'p1', 'u1', { title: 'T', assigneeId: 'u2' });
    expect(projects.findOneOrFail).toHaveBeenCalledWith('w1', 'p1');
    expect(events.emit).toHaveBeenCalledWith(
      TASK_CREATED,
      expect.objectContaining({ projectId: 'p1', actorId: 'u1' }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      TASK_ASSIGNED,
      expect.objectContaining({ assigneeId: 'u2' }),
    );
  });

  it('create() rejects a parent task outside the project', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.create('w1', 'p1', 'u1', { title: 'T', parentTaskId: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('findOneOrFail() 404s when the task is not in the project', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.findOneOrFail('w1', 'p1', 't1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update() to DONE sets completedAt and emits status + completed events', async () => {
    repo.findOne.mockResolvedValue({
      id: 't1',
      projectId: 'p1',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: 'u2',
      completedAt: null,
    });
    const saved = await service.update('w1', 'p1', 't1', 'u1', {
      status: TaskStatus.DONE,
    });
    expect(saved.completedAt).toBeInstanceOf(Date);
    expect(events.emit).toHaveBeenCalledWith(
      TASK_STATUS_CHANGED,
      expect.objectContaining({ from: TaskStatus.IN_PROGRESS, to: TaskStatus.DONE }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      TASK_COMPLETED,
      expect.objectContaining({ taskId: 't1' }),
    );
  });

  it('update() emits task.assigned when the assignee changes', async () => {
    repo.findOne.mockResolvedValue({
      id: 't1',
      projectId: 'p1',
      status: TaskStatus.TODO,
      assigneeId: null,
      completedAt: null,
    });
    await service.update('w1', 'p1', 't1', 'u1', { assigneeId: 'u3' });
    expect(events.emit).toHaveBeenCalledWith(
      TASK_ASSIGNED,
      expect.objectContaining({ assigneeId: 'u3' }),
    );
  });

  it('list() returns a keyset page with hasMore', async () => {
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

    const page = await service.list('w1', 'p1', { limit: 2 });
    expect(page.data).toHaveLength(2);
    expect(page.meta.hasMore).toBe(true);
  });
});
