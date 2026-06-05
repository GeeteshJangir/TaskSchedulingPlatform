import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  Page,
} from '../../common/pagination/pagination.util';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks.query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { TaskPriority } from './enums/task-priority.enum';
import { TaskStatus } from './enums/task-status.enum';
import {
  TASK_ASSIGNED,
  TASK_COMPLETED,
  TASK_CREATED,
  TASK_STATUS_CHANGED,
} from './events/task-events';
import { SubtreeNode } from './types';

/** Max nesting depth (root = 0). Guards re-parenting against runaway trees. */
const MAX_DEPTH = 5;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly projects: ProjectsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    projectId: string,
    createdBy: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    await this.projects.findOneOrFail(workspaceId, projectId);

    if (dto.parentTaskId) {
      const parent = await this.tasks.findOne({
        where: { id: dto.parentTaskId, projectId },
      });
      if (!parent) {
        throw new BadRequestException('Parent task not found in this project');
      }
    }

    const task = await this.tasks.save(
      this.tasks.create({
        projectId,
        createdBy,
        parentTaskId: dto.parentTaskId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        status: TaskStatus.TODO,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
    );

    this.events.emit(TASK_CREATED, {
      taskId: task.id,
      projectId,
      actorId: createdBy,
    });
    if (task.assigneeId) {
      this.events.emit(TASK_ASSIGNED, {
        taskId: task.id,
        assigneeId: task.assigneeId,
        actorId: createdBy,
      });
    }
    return task;
  }

  /** Keyset pagination + filters, scoped to the project. */
  async list(
    workspaceId: string,
    projectId: string,
    query: ListTasksQueryDto,
  ): Promise<Page<Task>> {
    await this.projects.findOneOrFail(workspaceId, projectId);
    const limit = query.limit ?? 20;

    const qb = this.tasks
      .createQueryBuilder('t')
      .where('t.project_id = :projectId', { projectId })
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .take(limit + 1);

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.assigneeId) qb.andWhere('t.assignee_id = :assigneeId', { assigneeId: query.assigneeId });
    if (query.parentTaskId) {
      qb.andWhere('t.parent_task_id = :parentTaskId', { parentTaskId: query.parentTaskId });
    } else if (query.topLevel) {
      qb.andWhere('t.parent_task_id IS NULL');
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(t.created_at, t.id) < (CAST(:cc AS timestamptz), CAST(:ci AS uuid))',
          { cc: decoded.createdAt, ci: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    return buildPage(rows, limit, (t) => encodeCursor(t.createdAt, t.id));
  }

  async findOneOrFail(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    await this.projects.findOneOrFail(workspaceId, projectId);
    const task = await this.tasks.findOne({ where: { id: taskId, projectId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    actorId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.findOneOrFail(workspaceId, projectId, taskId);
    const prevAssignee = task.assigneeId;
    const prevStatus = task.status;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.assigneeId !== undefined) task.assigneeId = dto.assigneeId;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
      task.completedAt = dto.status === TaskStatus.DONE ? new Date() : null;
    }

    const saved = await this.tasks.save(task);

    if (
      dto.assigneeId !== undefined &&
      dto.assigneeId !== prevAssignee &&
      saved.assigneeId
    ) {
      this.events.emit(TASK_ASSIGNED, {
        taskId: saved.id,
        assigneeId: saved.assigneeId,
        actorId,
      });
    }
    if (dto.status !== undefined && dto.status !== prevStatus) {
      this.events.emit(TASK_STATUS_CHANGED, {
        taskId: saved.id,
        from: prevStatus,
        to: saved.status,
        actorId,
      });
      if (saved.status === TaskStatus.DONE) {
        this.events.emit(TASK_COMPLETED, { taskId: saved.id, actorId });
      }
    }
    return saved;
  }

  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.findOneOrFail(workspaceId, projectId, taskId);
    await this.tasks.remove(task);
  }

  /**
   * Fetches a task and all its descendants as a nested tree (with depth),
   * using a single recursive CTE rather than N queries.
   */
  async getSubtree(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Promise<SubtreeNode> {
    await this.findOneOrFail(workspaceId, projectId, taskId);

    const rows: Array<{
      id: string;
      parent_task_id: string | null;
      title: string;
      status: string;
      priority: string;
      assignee_id: string | null;
      due_date: Date | null;
      depth: number;
    }> = await this.tasks.manager.query(
      `WITH RECURSIVE subtree AS (
         SELECT t.id, t.parent_task_id, t.title, t.status, t.priority,
                t.assignee_id, t.due_date, 0 AS depth
         FROM tasks t
         WHERE t.id = $1 AND t.project_id = $2
         UNION ALL
         SELECT c.id, c.parent_task_id, c.title, c.status, c.priority,
                c.assignee_id, c.due_date, s.depth + 1
         FROM tasks c
         JOIN subtree s ON c.parent_task_id = s.id
       )
       SELECT * FROM subtree ORDER BY depth ASC, id ASC`,
      [taskId, projectId],
    );

    const nodes = new Map<string, SubtreeNode>();
    for (const r of rows) {
      nodes.set(r.id, {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        assigneeId: r.assignee_id,
        dueDate: r.due_date,
        depth: Number(r.depth),
        children: [],
      });
    }
    let root: SubtreeNode | undefined;
    for (const r of rows) {
      const node = nodes.get(r.id)!;
      if (r.id === taskId) {
        root = node;
      } else if (r.parent_task_id) {
        nodes.get(r.parent_task_id)?.children.push(node);
      }
    }
    // findOneOrFail above guarantees the root exists.
    return root!;
  }

  /**
   * Re-parents a task. Guards: parent must be in the same project, not the task
   * itself, not a descendant (cycle), and the resulting depth must not exceed
   * MAX_DEPTH.
   */
  async moveTask(
    workspaceId: string,
    projectId: string,
    taskId: string,
    newParentId: string | null,
  ): Promise<Task> {
    const task = await this.findOneOrFail(workspaceId, projectId, taskId);

    if (newParentId === null) {
      task.parentTaskId = null;
      return this.tasks.save(task);
    }
    if (newParentId === taskId) {
      throw new BadRequestException('A task cannot be its own parent');
    }

    const newParent = await this.tasks.findOne({
      where: { id: newParentId, projectId },
    });
    if (!newParent) {
      throw new BadRequestException('New parent task not found in this project');
    }

    const descendants: Array<{ id: string; depth: number }> =
      await this.tasks.manager.query(
        `WITH RECURSIVE d AS (
           SELECT id, parent_task_id, 0 AS depth FROM tasks WHERE id = $1
           UNION ALL
           SELECT c.id, c.parent_task_id, d.depth + 1
           FROM tasks c JOIN d ON c.parent_task_id = d.id
         )
         SELECT id, depth FROM d`,
        [taskId],
      );

    if (descendants.some((d) => d.id === newParentId)) {
      throw new BadRequestException(
        'Cannot move a task underneath its own descendant (would create a cycle)',
      );
    }

    const subtreeHeight = descendants.reduce(
      (max, d) => Math.max(max, Number(d.depth)),
      0,
    );
    const parentDepth = await this.depthOf(newParentId);
    if (parentDepth + 1 + subtreeHeight > MAX_DEPTH) {
      throw new BadRequestException(
        `Maximum nesting depth of ${MAX_DEPTH} would be exceeded`,
      );
    }

    task.parentTaskId = newParentId;
    return this.tasks.save(task);
  }

  /** Depth of a task from its root (root = 0), via an upward recursive walk. */
  private async depthOf(taskId: string): Promise<number> {
    const rows: Array<{ depth: number }> = await this.tasks.manager.query(
      `WITH RECURSIVE a AS (
         SELECT id, parent_task_id, 0 AS depth FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id, t.parent_task_id, a.depth + 1
         FROM tasks t JOIN a ON t.id = a.parent_task_id
       )
       SELECT COALESCE(MAX(depth), 0) AS depth FROM a`,
      [taskId],
    );
    return Number(rows[0]?.depth ?? 0);
  }
}
