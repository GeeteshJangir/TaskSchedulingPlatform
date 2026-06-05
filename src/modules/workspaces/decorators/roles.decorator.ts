import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export const ROLES_KEY = 'workspace_roles';

/** Restricts a route to the given workspace role(s). Enforced by RolesGuard. */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
