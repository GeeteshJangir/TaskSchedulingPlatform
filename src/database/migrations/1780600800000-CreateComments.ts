import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M8 — comments. Self-referencing (parent_comment_id) for threaded replies,
 * with a no-self-parent CHECK. Cascades on task, author, and parent deletion.
 */
export class CreateComments1780600800000 implements MigrationInterface {
  name = 'CreateComments1780600800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id"                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        "task_id"           uuid        NOT NULL,
        "author_id"         uuid        NOT NULL,
        "parent_comment_id" uuid,
        "body"              text        NOT NULL,
        "edited_at"         timestamptz,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_comments_no_self_parent" CHECK ("parent_comment_id" <> "id"),
        CONSTRAINT "FK_comments_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_author" FOREIGN KEY ("author_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_parent" FOREIGN KEY ("parent_comment_id")
          REFERENCES "comments" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_task_created" ON "comments" ("task_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_comments_parent" ON "comments" ("parent_comment_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_comments_parent"`);
    await queryRunner.query(`DROP INDEX "IDX_comments_task_created"`);
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
