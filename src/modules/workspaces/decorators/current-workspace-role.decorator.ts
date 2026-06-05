import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceRole } from '../enums/workspace-role.enum';

/**
 * Injects the caller's role in the current workspace, set on the request by
 * WorkspaceMemberGuard. Used for ownership-or-admin checks.
 */
export const CurrentWorkspaceRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceRole | undefined =>
    ctx.switchToHttp().getRequest().workspaceRole,
);
