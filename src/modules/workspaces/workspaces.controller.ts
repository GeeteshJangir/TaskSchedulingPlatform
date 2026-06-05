import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { WorkspaceRole } from './enums/workspace-role.enum';
import { RolesGuard } from './guards/roles.guard';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(userId, dto);
  }

  @Get()
  listMine(@CurrentUser('userId') userId: string) {
    return this.workspaces.listForUser(userId);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  get(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.findByIdOrFail(workspaceId);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard)
  members(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles(WorkspaceRole.ADMIN)
  updateRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(workspaceId, userId, dto.role);
  }

  @Delete(':workspaceId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkspaceMemberGuard, RolesGuard)
  @Roles(WorkspaceRole.ADMIN)
  removeMember(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.workspaces.removeMember(workspaceId, userId);
  }
}
