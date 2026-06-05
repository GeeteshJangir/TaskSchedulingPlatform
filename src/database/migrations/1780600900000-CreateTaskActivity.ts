import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M9 — task_activity (append-only audit trail). `action` is varchar + CHECK
 * (the "likely to grow" enum strategy); `metadata` is jsonb for per-action
 * details (old/new values, comment ids, ...). actor_id SET NULL keeps history
 * if a user is removed.
 */
export class CreateTaskActivity1780600900000 implements MigrationInterface {
  name = 'CreateTaskActivity1780600900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "task_activity" (
        "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"    uuid        NOT NULL,
        "actor_id"   uuid,
        "action"     varchar(40) NOT NULL,
        "metadata"   jsonb       NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_task_activity_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_activity_actor" FOREIGN KEY ("actor_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_task_activity_action" CHECK ("action" IN (
          'CREATED', 'ASSIGNED', 'UNASSIGNED', 'STATUS_CHANGED',
          'COMPLETED', 'COMMENTED', 'REPLIED'
        ))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_task_activity_task_created" ON "task_activity" ("task_id", "created_at", "id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_task_activity_task_created"`);
    await queryRunner.query(`DROP TABLE "task_activity"`);
  }
}
