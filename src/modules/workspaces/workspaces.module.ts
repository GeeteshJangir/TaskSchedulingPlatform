import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { Workspace } from './entities/workspace.entity';
import { RolesGuard } from './guards/roles.guard';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/**
 * Owns workspaces + memberships + invitations and the workspace-scoped RBAC
 * primitives. Exports the service + guards so downstream modules (projects,
 * tasks) can reuse them for their own workspace-scoped routes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceInvitation]),
    UsersModule,
  ],
  controllers: [WorkspacesController, InvitationsController],
  providers: [
    WorkspacesService,
    InvitationsService,
    WorkspaceMemberGuard,
    RolesGuard,
  ],
  exports: [WorkspacesService, WorkspaceMemberGuard, RolesGuard],
})
export class WorkspacesModule {}
