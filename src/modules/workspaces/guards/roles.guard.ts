import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole } from '../enums/workspace-role.enum';

/**
 * Enforces @Roles(...) against request.workspaceRole, which WorkspaceMemberGuard
 * sets. Must run after WorkspaceMemberGuard. No @Roles metadata => allow.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }
    const request = ctx.switchToHttp().getRequest();
    const role: WorkspaceRole | undefined = request.workspaceRole;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Insufficient workspace role');
    }
    return true;
  }
}
