import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { slugify } from '../../common/utils/slugify.util';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceRole } from './enums/workspace-role.enum';

/** Membership cache TTL (ms). Short, so role changes propagate quickly. */
const MEMBERSHIP_TTL_MS = 30_000;

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Creates a workspace and its owner membership (ADMIN) atomically. */
  async create(ownerId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const slug = slugify(dto.slug ?? dto.name);

    return this.workspaces.manager.transaction(async (em) => {
      if (await em.getRepository(Workspace).countBy({ slug })) {
        throw new ConflictException('Workspace slug already taken');
      }
      const workspace = await em
        .getRepository(Workspace)
        .save(em.getRepository(Workspace).create({ name: dto.name, slug, ownerId }));

      await em.getRepository(WorkspaceMember).save(
        em.getRepository(WorkspaceMember).create({
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceRole.ADMIN,
        }),
      );
      return workspace;
    });
  }

  /** Workspaces the user belongs to (any role). */
  listForUser(userId: string): Promise<Workspace[]> {
    return this.workspaces
      .createQueryBuilder('w')
      .innerJoin(
        WorkspaceMember,
        'm',
        'm.workspace_id = w.id AND m.user_id = :userId',
        { userId },
      )
      .orderBy('w.created_at', 'DESC')
      .getMany();
  }

  async findByIdOrFail(id: string): Promise<Workspace> {
    const workspace = await this.workspaces.findOne({ where: { id } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    return workspace;
  }

  /**
   * Resolves a user's membership, cache-aside. WorkspaceMemberGuard calls this
   * on every workspace-scoped request, so caching removes a DB round-trip from
   * the hot path. Only positive memberships are cached (so accepting an invite
   * takes effect immediately); role changes/removals invalidate the key.
   */
  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const key = this.membershipKey(workspaceId, userId);
    const cached = await this.cache.get<WorkspaceMember>(key);
    if (cached) {
      return cached;
    }
    const membership = await this.members.findOne({
      where: { workspaceId, userId },
    });
    if (membership) {
      await this.cache.set(key, membership, MEMBERSHIP_TTL_MS);
    }
    return membership;
  }

  listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.members.find({
      where: { workspaceId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const workspace = await this.findByIdOrFail(workspaceId);
    if (workspace.ownerId === targetUserId) {
      throw new ForbiddenException('The workspace owner role cannot be changed');
    }
    const membership = await this.members.findOne({
      where: { workspaceId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    membership.role = role;
    const saved = await this.members.save(membership);
    await this.invalidateMembership(workspaceId, targetUserId);
    return saved;
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    const workspace = await this.findByIdOrFail(workspaceId);
    if (workspace.ownerId === targetUserId) {
      throw new ForbiddenException('The workspace owner cannot be removed');
    }
    const membership = await this.members.findOne({
      where: { workspaceId, userId: targetUserId },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }
    await this.members.remove(membership);
    await this.invalidateMembership(workspaceId, targetUserId);
  }

  private membershipKey(workspaceId: string, userId: string): string {
    return `membership:${workspaceId}:${userId}`;
  }

  private invalidateMembership(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    return this.cache.del(this.membershipKey(workspaceId, userId));
  }
}
