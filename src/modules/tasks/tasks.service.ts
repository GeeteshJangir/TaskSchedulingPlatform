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
}
