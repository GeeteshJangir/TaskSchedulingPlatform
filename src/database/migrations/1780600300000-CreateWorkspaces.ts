import { MigrationInterface, QueryRunner } from 'typeorm';

/** M3 — workspaces. owner_id is RESTRICT (can't delete a user who owns a workspace). */
export class CreateWorkspaces1780600300000 implements MigrationInterface {
  name = 'CreateWorkspaces1780600300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id"         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"       varchar(160) NOT NULL,
        "slug"       citext       NOT NULL,
        "owner_id"   uuid         NOT NULL,
        "created_at" timestamptz  NOT NULL DEFAULT now(),
        "updated_at" timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_workspaces_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_workspaces_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_workspaces_owner_id" ON "workspaces" ("owner_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_workspaces_owner_id"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
  }
}
