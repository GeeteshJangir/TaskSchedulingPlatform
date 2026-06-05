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
      manager: { query: jest.fn() },
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

  it('getSubtree() builds a nested tree with depth', async () => {
    repo.findOne.mockResolvedValue({ id: 'root', projectId: 'p1' });
    repo.manager.query.mockResolvedValue([
      { id: 'root', parent_task_id: null, title: 'R', status: 'TODO', priority: 'MEDIUM', assignee_id: null, due_date: null, depth: 0 },
      { id: 'c1', parent_task_id: 'root', title: 'C1', status: 'TODO', priority: 'LOW', assignee_id: null, due_date: null, depth: 1 },
      { id: 'c2', parent_task_id: 'c1', title: 'C2', status: 'TODO', priority: 'LOW', assignee_id: null, due_date: null, depth: 2 },
    ]);

    const tree = await service.getSubtree('w1', 'p1', 'root');
    expect(tree.id).toBe('root');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].id).toBe('c1');
    expect(tree.children[0].children[0].id).toBe('c2');
    expect(tree.children[0].children[0].depth).toBe(2);
  });

  it('moveTask() rejects a move that would create a cycle', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 't1', projectId: 'p1', parentTaskId: null })
      .mockResolvedValueOnce({ id: 't2', projectId: 'p1' });
    // t2 is a descendant of t1
    repo.manager.query.mockResolvedValueOnce([
      { id: 't1', depth: 0 },
      { id: 't2', depth: 1 },
    ]);
    await expect(service.moveTask('w1', 'p1', 't1', 't2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('moveTask() rejects exceeding max nesting depth', async () => {
    repo.findOne
      .mockResolvedValueOnce({ id: 't1', projectId: 'p1', parentTaskId: null })
      .mockResolvedValueOnce({ id: 'np', projectId: 'p1' });
    repo.manager.query
      .mockResolvedValueOnce([{ id: 't1', depth: 0 }, { id: 'x', depth: 3 }]) // height 3
      .mockResolvedValueOnce([{ depth: 4 }]); // parent depth 4 -> 4+1+3 = 8 > 5
    await expect(service.moveTask('w1', 'p1', 't1', 'np')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('moveTask() sets the new parent when valid', async () => {
    const task = { id: 't1', projectId: 'p1', parentTaskId: null };
    repo.findOne
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce({ id: 'np', projectId: 'p1' });
    repo.manager.query
      .mockResolvedValueOnce([{ id: 't1', depth: 0 }]) // height 0
      .mockResolvedValueOnce([{ depth: 1 }]); // parent depth 1 -> 1+1+0 = 2 <= 5
    await service.moveTask('w1', 'p1', 't1', 'np');
    expect(task.parentTaskId).toBe('np');
  });

  it('moveTask(null) moves the task to the top level', async () => {
    const task = { id: 't1', projectId: 'p1', parentTaskId: 'old' };
    repo.findOne.mockResolvedValueOnce(task);
    await service.moveTask('w1', 'p1', 't1', null);
    expect(task.parentTaskId).toBeNull();
  });
});
