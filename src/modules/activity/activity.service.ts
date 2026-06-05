import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  Page,
} from '../../common/pagination/pagination.util';
import { TasksService } from '../tasks/tasks.service';
import { ListActivityQueryDto } from './dto/list-activity.query.dto';
import { TaskActivity } from './entities/task-activity.entity';
import { ActivityAction } from './enums/activity-action.enum';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(TaskActivity)
    private readonly activity: Repository<TaskActivity>,
    private readonly tasks: TasksService,
  ) {}

  /** Append an activity row. Called by the event listener (best-effort audit). */
  async record(
    taskId: string,
    actorId: string | null,
    action: ActivityAction,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.activity.save(
      this.activity.create({ taskId, actorId, action, metadata }),
    );
  }

  /** Paginated activity feed for a task (keyset, newest first). */
  async listForTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    query: ListActivityQueryDto,
  ): Promise<Page<TaskActivity>> {
    await this.tasks.findOneOrFail(workspaceId, projectId, taskId);
    const limit = query.limit ?? 20;

    const qb = this.activity
      .createQueryBuilder('a')
      .where('a.task_id = :taskId', { taskId })
      .orderBy('a.created_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .take(limit + 1);

    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(a.created_at, a.id) < (CAST(:cc AS timestamptz), CAST(:ci AS uuid))',
          { cc: decoded.createdAt, ci: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    return buildPage(rows, limit, (a) => encodeCursor(a.createdAt, a.id));
  }
}
