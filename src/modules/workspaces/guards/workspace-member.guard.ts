import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../../../common/types/auth-user';
import { WorkspacesService } from '../workspaces.service';

/**
 * Resolves the caller's membership in the workspace identified by the route
 * (params.workspaceId or body.workspaceId), rejects non-members, and attaches
 * the membership + role to the request for RolesGuard / handlers.
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly workspaces: WorkspacesService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    const workspaceId: string | undefined =
      request.params?.workspaceId ?? request.body?.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    const membership = await this.workspaces.getMembership(
      workspaceId,
      user.userId,
    );
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    request.workspaceMembership = membership;
    request.workspaceRole = membership.role;
    return true;
  }
}
