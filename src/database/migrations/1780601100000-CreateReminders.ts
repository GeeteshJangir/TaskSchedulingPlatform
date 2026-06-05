import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M11 — reminders. UNIQUE(task_id, type, scheduled_for) is the idempotency
 * backbone: the scheduler can run repeatedly (or concurrently) and never create
 * a duplicate reminder for the same task/window.
 */
export class CreateReminders1780601100000 implements MigrationInterface {
  name = 'CreateReminders1780601100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "reminder_type" AS ENUM ('DUE_SOON', 'OVERDUE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "reminder_status" AS ENUM ('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id"            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"       uuid              NOT NULL,
        "type"          "reminder_type"   NOT NULL,
        "scheduled_for" timestamptz       NOT NULL,
        "status"        "reminder_status" NOT NULL DEFAULT 'PENDING',
        "attempts"      integer           NOT NULL DEFAULT 0,
        "sent_at"       timestamptz,
        "created_at"    timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reminders_task_type_scheduled"
          UNIQUE ("task_id", "type", "scheduled_for"),
        CONSTRAINT "FK_reminders_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_status_scheduled" ON "reminders" ("status", "scheduled_for")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reminders_status_scheduled"`);
    await queryRunner.query(`DROP TABLE "reminders"`);
    await queryRunner.query(`DROP TYPE "reminder_status"`);
    await queryRunner.query(`DROP TYPE "reminder_type"`);
  }
}
