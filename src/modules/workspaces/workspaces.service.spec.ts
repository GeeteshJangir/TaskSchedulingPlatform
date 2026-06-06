import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceRole } from './enums/workspace-role.enum';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let wsRepo: { findOne: jest.Mock };
  let memberRepo: { findOne: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    wsRepo = { findOne: jest.fn() };
    memberRepo = { findOne: jest.fn(), save: jest.fn(), remove: jest.fn() };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: getRepositoryToken(Workspace), useValue: wsRepo },
        { provide: getRepositoryToken(WorkspaceMember), useValue: memberRepo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = moduleRef.get(WorkspacesService);
  });

  it('getMembership() returns the cached value without hitting the DB', async () => {
    cache.get.mockResolvedValue({ id: 'm1', role: WorkspaceRole.ADMIN });
    await expect(service.getMembership('w1', 'u1')).resolves.toEqual({
      id: 'm1',
      role: WorkspaceRole.ADMIN,
    });
    expect(memberRepo.findOne).not.toHaveBeenCalled();
  });

  it('getMembership() caches a positive lookup (cache-aside)', async () => {
    cache.get.mockResolvedValue(undefined);
    memberRepo.findOne.mockResolvedValue({ id: 'm1' });
    await service.getMembership('w1', 'u1');
    expect(cache.set).toHaveBeenCalledWith(
      'membership:w1:u1',
      { id: 'm1' },
      expect.any(Number),
    );
  });

  it('updateMemberRole() invalidates the membership cache', async () => {
    wsRepo.findOne.mockResolvedValue({ id: 'w1', ownerId: 'owner' });
    memberRepo.findOne.mockResolvedValue({ role: WorkspaceRole.MEMBER });
    memberRepo.save.mockImplementation(async (m: WorkspaceMember) => m);
    await service.updateMemberRole('w1', 'u2', WorkspaceRole.ADMIN);
    expect(cache.del).toHaveBeenCalledWith('membership:w1:u2');
  });

  it('getMembership() delegates to the repository', async () => {
    memberRepo.findOne.mockResolvedValue({ id: 'm1' });
    await expect(service.getMembership('w1', 'u1')).resolves.toEqual({
      id: 'm1',
    });
    expect(memberRepo.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'w1', userId: 'u1' },
    });
  });

  it('updateMemberRole() forbids changing the owner role', async () => {
    wsRepo.findOne.mockResolvedValue({ id: 'w1', ownerId: 'owner' });
    await expect(
      service.updateMemberRole('w1', 'owner', WorkspaceRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateMemberRole() 404s when the member is missing', async () => {
    wsRepo.findOne.mockResolvedValue({ id: 'w1', ownerId: 'owner' });
    memberRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateMemberRole('w1', 'u2', WorkspaceRole.ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateMemberRole() persists the new role', async () => {
    wsRepo.findOne.mockResolvedValue({ id: 'w1', ownerId: 'owner' });
    memberRepo.findOne.mockResolvedValue({ role: WorkspaceRole.MEMBER });
    memberRepo.save.mockImplementation(async (m: WorkspaceMember) => m);

    const res = await service.updateMemberRole('w1', 'u2', WorkspaceRole.ADMIN);
    expect(res.role).toBe(WorkspaceRole.ADMIN);
  });

  it('removeMember() forbids removing the owner', async () => {
    wsRepo.findOne.mockResolvedValue({ id: 'w1', ownerId: 'owner' });
    await expect(service.removeMember('w1', 'owner')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
