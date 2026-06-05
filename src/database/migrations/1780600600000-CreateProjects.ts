import { MigrationInterface, QueryRunner } from 'typeorm';

/** M6 — projects within a workspace. */
export class CreateProjects1780600600000 implements MigrationInterface {
  name = 'CreateProjects1780600600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'ARCHIVED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid             NOT NULL,
        "name"         varchar(160)     NOT NULL,
        "description"  text,
        "status"       "project_status" NOT NULL DEFAULT 'ACTIVE',
        "created_by"   uuid             NOT NULL,
        "created_at"   timestamptz      NOT NULL DEFAULT now(),
        "updated_at"   timestamptz      NOT NULL DEFAULT now(),
        CONSTRAINT "FK_projects_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_projects_creator" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_workspace_id" ON "projects" ("workspace_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_workspace_created" ON "projects" ("workspace_id", "created_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_projects_workspace_created"`);
    await queryRunner.query(`DROP INDEX "IDX_projects_workspace_id"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "project_status"`);
  }
}
