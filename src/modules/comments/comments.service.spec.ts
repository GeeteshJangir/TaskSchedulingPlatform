import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';
import { COMMENT_CREATED, COMMENT_REPLIED } from './events/comment-events';

describe('CommentsService', () => {
  let service: CommentsService;
  let repo: any;
  let tasks: { findOneOrFail: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: x.id ?? 'c1', ...x })),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    tasks = { findOneOrFail: jest.fn().mockResolvedValue({ id: 't1' }) };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repo },
        { provide: TasksService, useValue: tasks },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(CommentsService);
  });

  it('create() emits comment.created', async () => {
    await service.create('w1', 'p1', 't1', 'u1', { body: 'hi' });
    expect(tasks.findOneOrFail).toHaveBeenCalledWith('w1', 'p1', 't1');
    expect(events.emit).toHaveBeenCalledWith(
      COMMENT_CREATED,
      expect.objectContaining({ taskId: 't1', authorId: 'u1' }),
    );
  });

  it('create() reply validates parent and emits comment.replied with parent author', async () => {
    repo.findOne.mockResolvedValue({ id: 'parent', taskId: 't1', authorId: 'u2' });
    await service.create('w1', 'p1', 't1', 'u1', {
      body: 'reply',
      parentCommentId: 'parent',
    });
    expect(events.emit).toHaveBeenCalledWith(
      COMMENT_REPLIED,
      expect.objectContaining({ parentCommentId: 'parent', parentAuthorId: 'u2' }),
    );
  });

  it('create() rejects a reply to a comment not on the task', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.create('w1', 'p1', 't1', 'u1', { body: 'x', parentCommentId: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update() forbids editing someone else’s comment', async () => {
    repo.findOne.mockResolvedValue({ id: 'c1', taskId: 't1', authorId: 'owner' });
    await expect(
      service.update('w1', 'p1', 't1', 'c1', 'intruder', { body: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update() lets the author edit and stamps editedAt', async () => {
    repo.findOne.mockResolvedValue({ id: 'c1', taskId: 't1', authorId: 'u1', body: 'old' });
    const saved = await service.update('w1', 'p1', 't1', 'c1', 'u1', { body: 'new' });
    expect(saved.body).toBe('new');
    expect(saved.editedAt).toBeInstanceOf(Date);
  });

  it('remove() forbids a non-author non-admin', async () => {
    repo.findOne.mockResolvedValue({ id: 'c1', taskId: 't1', authorId: 'owner' });
    await expect(
      service.remove('w1', 'p1', 't1', 'c1', 'intruder', WorkspaceRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('remove() allows a workspace admin to delete any comment', async () => {
    repo.findOne.mockResolvedValue({ id: 'c1', taskId: 't1', authorId: 'owner' });
    await service.remove('w1', 'p1', 't1', 'c1', 'admin', WorkspaceRole.ADMIN);
    expect(repo.remove).toHaveBeenCalled();
  });
});
