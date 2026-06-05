import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M7 — tasks. Self-referencing (parent_task_id) for nested subtasks, with a
 * CHECK preventing a task being its own parent. Partial index on due_date
 * (open tasks only) feeds the Phase 7 reminder scheduler.
 */
export class CreateTasks1780600700000 implements MigrationInterface {
  name = 'CreateTasks1780600700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id"             uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id"     uuid            NOT NULL,
        "parent_task_id" uuid,
        "title"          varchar(200)    NOT NULL,
        "description"    text,
        "status"         "task_status"   NOT NULL DEFAULT 'TODO',
        "priority"       "task_priority" NOT NULL DEFAULT 'MEDIUM',
        "assignee_id"    uuid,
        "created_by"     uuid            NOT NULL,
        "due_date"       timestamptz,
        "completed_at"   timestamptz,
        "created_at"     timestamptz     NOT NULL DEFAULT now(),
        "updated_at"     timestamptz     NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_tasks_no_self_parent" CHECK ("parent_task_id" <> "id"),
        CONSTRAINT "FK_tasks_project" FOREIGN KEY ("project_id")
          REFERENCES "projects" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_parent" FOREIGN KEY ("parent_task_id")
          REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_assignee" FOREIGN KEY ("assignee_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tasks_creator" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_project_id" ON "tasks" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_parent_task_id" ON "tasks" ("parent_task_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_assignee_id" ON "tasks" ("assignee_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_created" ON "tasks" ("project_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_due_open" ON "tasks" ("due_date") WHERE status NOT IN ('DONE', 'CANCELLED')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tasks_due_open"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_project_created"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_status"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_assignee_id"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_parent_task_id"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_project_id"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TYPE "task_priority"`);
    await queryRunner.query(`DROP TYPE "task_status"`);
  }
}
