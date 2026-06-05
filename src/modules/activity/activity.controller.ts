import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../workspaces/guards/workspace-member.guard';
import { ActivityService } from './activity.service';
import { ListActivityQueryDto } from './dto/list-activity.query.dto';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/tasks/:taskId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: ListActivityQueryDto,
  ) {
    return this.activity.listForTask(workspaceId, projectId, taskId, query);
  }
}
