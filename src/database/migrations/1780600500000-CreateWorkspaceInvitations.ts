import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M5 — workspace_invitations. A partial UNIQUE index guarantees at most one
 * PENDING invitation per (workspace, email) while still allowing historical
 * ACCEPTED/REVOKED/EXPIRED rows.
 */
export class CreateWorkspaceInvitations1780600500000
  implements MigrationInterface
{
  name = 'CreateWorkspaceInvitations1780600500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "workspace_invitations" (
        "id"           uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
        "workspace_id" uuid                    NOT NULL,
        "email"        citext                  NOT NULL,
        "role"         "workspace_member_role" NOT NULL DEFAULT 'MEMBER',
        "token"        varchar(64)             NOT NULL,
        "status"       "invitation_status"     NOT NULL DEFAULT 'PENDING',
        "invited_by"   uuid                    NOT NULL,
        "expires_at"   timestamptz             NOT NULL,
        "created_at"   timestamptz             NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_workspace_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_workspace_invitations_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_workspace_invitations_inviter" FOREIGN KEY ("invited_by")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_workspace_invitations_workspace_id" ON "workspace_invitations" ("workspace_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_workspace_invitations_pending_email"
        ON "workspace_invitations" ("workspace_id", "email")
        WHERE status = 'PENDING'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_workspace_invitations_pending_email"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_workspace_invitations_workspace_id"`);
    await queryRunner.query(`DROP TABLE "workspace_invitations"`);
    await queryRunner.query(`DROP TYPE "invitation_status"`);
  }
}
