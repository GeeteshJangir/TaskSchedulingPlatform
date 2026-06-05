import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'p1', ...x })),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(ProjectsService);
  });

  it('create() persists a project with workspace, creator, and ACTIVE status', async () => {
    const res = await service.create('w1', 'u1', { name: 'P' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'w1',
        createdBy: 'u1',
        name: 'P',
        status: ProjectStatus.ACTIVE,
      }),
    );
    expect(res.id).toBe('p1');
  });

  it('findOneOrFail() throws when the project is not in the workspace', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOneOrFail('w1', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update() applies provided fields and saves', async () => {
    repo.findOne.mockResolvedValue({
      id: 'p1',
      name: 'Old',
      description: null,
      status: ProjectStatus.ACTIVE,
    });
    const res = await service.update('w1', 'p1', {
      name: 'New',
      status: ProjectStatus.ARCHIVED,
    });
    expect(res.name).toBe('New');
    expect(res.status).toBe(ProjectStatus.ARCHIVED);
  });

  it('list() returns a keyset page and flags hasMore', async () => {
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

    const page = await service.list('w1', { limit: 2 });
    expect(page.data).toHaveLength(2);
    expect(page.meta.hasMore).toBe(true);
    expect(page.meta.nextCursor).not.toBeNull();
    expect(qb.take).toHaveBeenCalledWith(3); // limit + 1
  });
});
