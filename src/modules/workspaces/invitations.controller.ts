import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { Roles } from './decorators/roles.decorator';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceRole } from './enums/workspace-role.enum';
import { RolesGuard } from './guards/roles.guard';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('workspaces/:workspaceId/invitations')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles(WorkspaceRole.ADMIN)
  invite(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.invite(workspaceId, userId, dto);
  }

  @Get('workspaces/:workspaceId/invitations')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles(WorkspaceRole.ADMIN)
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.invitations.listForWorkspace(workspaceId);
  }

  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles(WorkspaceRole.ADMIN)
  revoke(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.invitations.revoke(workspaceId, invitationId);
  }

  @Post('invitations/accept')
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(user.userId, user.email, dto.token);
  }
}
