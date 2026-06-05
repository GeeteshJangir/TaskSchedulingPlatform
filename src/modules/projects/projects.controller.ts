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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { WorkspaceMemberGuard } from '../workspaces/guards/workspace-member.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects.query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard, RolesGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // Create/edit are open to any workspace member; delete stays ADMIN-only.
  @Post()
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(workspaceId, userId, dto);
  }

  @Get()
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projects.list(workspaceId, query);
  }

  @Get(':projectId')
  get(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.findOneOrFail(workspaceId, projectId);
  }

  @Patch(':projectId')
  update(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, projectId, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(WorkspaceRole.ADMIN)
  remove(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projects.remove(workspaceId, projectId);
  }
}
