import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M10 — notifications (per-user inbox). `type` is varchar + CHECK. Composite
 * index on (recipient_id, created_at, id) drives the keyset feed; a partial
 * index on unread rows powers the unread count/list.
 */
export class CreateNotifications1780601000000 implements MigrationInterface {
  name = 'CreateNotifications1780601000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipient_id" uuid        NOT NULL,
        "type"         varchar(40) NOT NULL,
        "title"        varchar(200) NOT NULL,
        "body"         text,
        "entity_type"  varchar(40),
        "entity_id"    uuid,
        "workspace_id" uuid,
        "is_read"      boolean     NOT NULL DEFAULT false,
        "read_at"      timestamptz,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_notifications_recipient" FOREIGN KEY ("recipient_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_workspace" FOREIGN KEY ("workspace_id")
          REFERENCES "workspaces" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_notifications_type" CHECK ("type" IN (
          'TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'TASK_COMPLETED',
          'COMMENT_ADDED', 'COMMENT_REPLY', 'WORKSPACE_INVITE'
        ))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_recipient_created" ON "notifications" ("recipient_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_recipient_unread" ON "notifications" ("recipient_id") WHERE is_read = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_unread"`);
    await queryRunner.query(`DROP INDEX "IDX_notifications_recipient_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
