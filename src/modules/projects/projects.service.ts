import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildPage,
  decodeCursor,
  encodeCursor,
  Page,
} from '../../common/pagination/pagination.util';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects.query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  create(
    workspaceId: string,
    createdBy: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    const project = this.projects.create({
      workspaceId,
      createdBy,
      name: dto.name,
      description: dto.description ?? null,
      status: ProjectStatus.ACTIVE,
    });
    return this.projects.save(project);
  }

  /** Keyset pagination over (created_at, id) DESC, scoped to the workspace. */
  async list(
    workspaceId: string,
    query: ListProjectsQueryDto,
  ): Promise<Page<Project>> {
    const limit = query.limit ?? 20;
    const qb = this.projects
      .createQueryBuilder('p')
      .where('p.workspace_id = :workspaceId', { workspaceId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .take(limit + 1);

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      if (decoded) {
        qb.andWhere(
          '(p.created_at, p.id) < (CAST(:cursorCreatedAt AS timestamptz), CAST(:cursorId AS uuid))',
          { cursorCreatedAt: decoded.createdAt, cursorId: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    return buildPage(rows, limit, (p) => encodeCursor(p.createdAt, p.id));
  }

  async findOneOrFail(workspaceId: string, projectId: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id: projectId, workspaceId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(
    workspaceId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOneOrFail(workspaceId, projectId);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status !== undefined) project.status = dto.status;
    return this.projects.save(project);
  }

  async remove(workspaceId: string, projectId: string): Promise<void> {
    const project = await this.findOneOrFail(workspaceId, projectId);
    await this.projects.remove(project);
  }
}
