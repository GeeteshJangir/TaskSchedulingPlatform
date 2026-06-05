import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { InvitationStatus } from './enums/invitation-status.enum';
import { WorkspaceRole } from './enums/workspace-role.enum';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  let service: InvitationsService;
  let invRepo: any;
  let memberRepo: any;
  let users: { findByEmail: jest.Mock };

  beforeEach(async () => {
    memberRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
    };
    invRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((x) => x),
      create: jest.fn((x) => x),
      manager: {
        transaction: jest.fn(async (cb) =>
          cb({
            getRepository: (entity: unknown) =>
              entity === WorkspaceMember ? memberRepo : invRepo,
          }),
        ),
      },
    };
    users = { findByEmail: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: getRepositoryToken(WorkspaceInvitation), useValue: invRepo },
        { provide: getRepositoryToken(WorkspaceMember), useValue: memberRepo },
        { provide: UsersService, useValue: users },
      ],
    }).compile();

    service = moduleRef.get(InvitationsService);
  });

  it('invite() conflicts when the invitee is already a member', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u2' });
    memberRepo.findOne.mockResolvedValue({ id: 'm1' });
    await expect(
      service.invite('w1', 'admin', { email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invite() conflicts when a pending invite already exists', async () => {
    users.findByEmail.mockResolvedValue(null);
    invRepo.findOne.mockResolvedValue({ id: 'inv1' });
    await expect(
      service.invite('w1', 'admin', { email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invite() creates a pending invitation with a token', async () => {
    users.findByEmail.mockResolvedValue(null);
    invRepo.findOne.mockResolvedValue(null);
    const inv = await service.invite('w1', 'admin', {
      email: 'a@b.com',
      role: WorkspaceRole.MEMBER,
    });
    expect(inv.status).toBe(InvitationStatus.PENDING);
    expect(typeof inv.token).toBe('string');
    expect(inv.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('accept() 404s for an unknown/non-pending token', async () => {
    invRepo.findOne.mockResolvedValue(null);
    await expect(
      service.accept('u1', 'a@b.com', 'tok'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('accept() marks expired invitations and throws Gone', async () => {
    const inv = {
      status: InvitationStatus.PENDING,
      email: 'a@b.com',
      expiresAt: new Date(Date.now() - 1000),
    };
    invRepo.findOne.mockResolvedValue(inv);
    await expect(
      service.accept('u1', 'a@b.com', 'tok'),
    ).rejects.toBeInstanceOf(GoneException);
    expect(inv.status).toBe(InvitationStatus.EXPIRED);
  });

  it('accept() rejects an email mismatch', async () => {
    invRepo.findOne.mockResolvedValue({
      status: InvitationStatus.PENDING,
      email: 'invited@b.com',
      expiresAt: new Date(Date.now() + 10000),
    });
    await expect(
      service.accept('u1', 'someone-else@b.com', 'tok'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accept() creates membership and marks the invitation accepted', async () => {
    const inv = {
      workspaceId: 'w1',
      role: WorkspaceRole.MEMBER,
      status: InvitationStatus.PENDING,
      email: 'a@b.com',
      expiresAt: new Date(Date.now() + 10000),
    };
    invRepo.findOne.mockResolvedValue(inv);
    memberRepo.findOne.mockResolvedValue(null);

    const membership = await service.accept('u1', 'a@b.com', 'tok');
    expect(membership).toEqual(
      expect.objectContaining({ workspaceId: 'w1', userId: 'u1' }),
    );
    expect(inv.status).toBe(InvitationStatus.ACCEPTED);
  });

  it('revoke() only allows pending invitations', async () => {
    invRepo.findOne.mockResolvedValue({ status: InvitationStatus.ACCEPTED });
    await expect(service.revoke('w1', 'inv1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('revoke() sets a pending invitation to REVOKED', async () => {
    const inv = { status: InvitationStatus.PENDING };
    invRepo.findOne.mockResolvedValue(inv);
    await service.revoke('w1', 'inv1');
    expect(inv.status).toBe(InvitationStatus.REVOKED);
  });
});
