import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M4 — workspace_members (the M2M + RBAC table). Creates the
 * workspace_member_role enum lazily here (first use). UNIQUE(workspace_id,
 * user_id) prevents duplicate memberships.
 */
export class CreateWorkspaceMembers1780600400000 implements MigrationInterface {
  name = 'CreateWorkspaceMembers1780600400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "workspace_member_role" AS ENUM ('ADMIN', 'MEMBER')`,
    );
    await queryRunner.query(`
      CREATE TABLE "workspace_members" (
        "id"           uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid                    NOT NULL,
        "user_id"      uuid                    NOT NULL,
        "role"         "workspace_member_role" NOT NULL DEFAULT 'MEMBER',
        "joined_at"    timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_workspace_members_ws_user" UNIQUE ("workspace_id", "user_id"),
        CONSTRAINT "FK_workspace_members_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_members_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_workspace_members_user_id" ON "workspace_members" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_workspace_members_user_id"`);
    await queryRunner.query(`DROP TABLE "workspace_members"`);
    await queryRunner.query(`DROP TYPE "workspace_member_role"`);
  }
}
