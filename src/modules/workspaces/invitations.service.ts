import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { InvitationStatus } from './enums/invitation-status.enum';
import { WorkspaceRole } from './enums/workspace-role.enum';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(WorkspaceInvitation)
    private readonly invitations: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    private readonly users: UsersService,
  ) {}

  async invite(
    workspaceId: string,
    inviterId: string,
    dto: CreateInvitationDto,
  ): Promise<WorkspaceInvitation> {
    const existingUser = await this.users.findByEmail(dto.email);
    if (existingUser) {
      const membership = await this.members.findOne({
        where: { workspaceId, userId: existingUser.id },
      });
      if (membership) {
        throw new ConflictException('User is already a member of this workspace');
      }
    }

    const pending = await this.invitations.findOne({
      where: {
        workspaceId,
        email: dto.email,
        status: InvitationStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    const invitation = this.invitations.create({
      workspaceId,
      email: dto.email,
      role: dto.role ?? WorkspaceRole.MEMBER,
      token: randomBytes(32).toString('base64url'),
      status: InvitationStatus.PENDING,
      invitedBy: inviterId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    return this.invitations.save(invitation);
  }

  listForWorkspace(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return this.invitations.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Accepts an invitation for the authenticated user (email must match). */
  async accept(
    userId: string,
    userEmail: string,
    token: string,
  ): Promise<WorkspaceMember> {
    const invitation = await this.invitations.findOne({ where: { token } });
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException('Invitation not found or no longer pending');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitations.save(invitation);
      throw new GoneException('Invitation has expired');
    }
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was issued to a different email address',
      );
    }

    return this.invitations.manager.transaction(async (em) => {
      const memberRepo = em.getRepository(WorkspaceMember);
      let membership = await memberRepo.findOne({
        where: { workspaceId: invitation.workspaceId, userId },
      });
      if (!membership) {
        membership = await memberRepo.save(
          memberRepo.create({
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
          }),
        );
      }
      invitation.status = InvitationStatus.ACCEPTED;
      await em.getRepository(WorkspaceInvitation).save(invitation);
      return membership;
    });
  }

  async revoke(workspaceId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, workspaceId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictException('Only pending invitations can be revoked');
    }
    invitation.status = InvitationStatus.REVOKED;
    await this.invitations.save(invitation);
  }
}
