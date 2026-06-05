import {
  BadRequestException,
  ForbiddenException,
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
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceRole } from '../workspaces/enums/workspace-role.enum';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments.query.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';
import { COMMENT_CREATED, COMMENT_REPLIED } from './events/comment-events';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    private readonly tasks: TasksService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    workspaceId: string,
    projectId: string,
    taskId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const task = await this.tasks.findOneOrFail(workspaceId, projectId, taskId);

    let parentAuthorId: string | undefined;
    if (dto.parentCommentId) {
      const parent = await this.comments.findOne({
        where: { id: dto.parentCommentId, taskId },
      });
      if (!parent) {
        throw new BadRequestException('Parent comment not found on this task');
      }
      parentAuthorId = parent.authorId;
    }

    const comment = await this.comments.save(
      this.comments.create({
        taskId,
        authorId,
        parentCommentId: dto.parentCommentId ?? null,
        body: dto.body,
      }),
    );

    this.events.emit(COMMENT_CREATED, {
      commentId: comment.id,
      taskId,
      authorId,
      parentCommentId: comment.parentCommentId,
      taskAssigneeId: task.assigneeId,
    });
    if (comment.parentCommentId && parentAuthorId) {
      this.events.emit(COMMENT_REPLIED, {
        commentId: comment.id,
        taskId,
        parentCommentId: comment.parentCommentId,
        parentAuthorId,
        authorId,
      });
    }
    return comment;
  }

  async list(
    workspaceId: string,
    projectId: string,
    taskId: string,
    query: ListCommentsQueryDto,
  ): Promise<Page<Comment>> {
    await this.tasks.findOneOrFail(workspaceId, projectId, taskId);
    const limit = query.limit ?? 20;

    const qb = this.comments
      .createQueryBuilder('c')
      .where('c.task_id = :taskId', { taskId })
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit + 1);

    if (query.parentCommentId) {
      qb.andWhere('c.parent_comment_id = :parentCommentId', {
        parentCommentId: query.parentCommentId,
      });
    } else if (query.topLevel) {
      qb.andWhere('c.parent_comment_id IS NULL');
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(c.created_at, c.id) < (CAST(:cc AS timestamptz), CAST(:ci AS uuid))',
          { cc: decoded.createdAt, ci: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    return buildPage(rows, limit, (c) => encodeCursor(c.createdAt, c.id));
  }

  async findOneOrFail(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
  ): Promise<Comment> {
    await this.tasks.findOneOrFail(workspaceId, projectId, taskId);
    const comment = await this.comments.findOne({
      where: { id: commentId, taskId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  /** Only the author may edit their own comment. */
  async update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    actorId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOneOrFail(
      workspaceId,
      projectId,
      taskId,
      commentId,
    );
    if (comment.authorId !== actorId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }
    comment.body = dto.body;
    comment.editedAt = new Date();
    return this.comments.save(comment);
  }

  /** The author or a workspace ADMIN may delete a comment. */
  async remove(
    workspaceId: string,
    projectId: string,
    taskId: string,
    commentId: string,
    actorId: string,
    actorRole: WorkspaceRole | undefined,
  ): Promise<void> {
    const comment = await this.findOneOrFail(
      workspaceId,
      projectId,
      taskId,
      commentId,
    );
    if (comment.authorId !== actorId && actorRole !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException(
        'Only the author or a workspace admin can delete this comment',
      );
    }
    await this.comments.remove(comment);
  }
}
