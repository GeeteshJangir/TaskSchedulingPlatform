import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M1 — users table. Email is citext + UNIQUE (case-insensitive identity).
 * password_hash is stored here but marked select:false on the entity.
 */
export class CreateUsers1780600100000 implements MigrationInterface {
  name = 'CreateUsers1780600100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "email"         citext       NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "name"          varchar(255) NOT NULL,
        "is_active"     boolean      NOT NULL DEFAULT true,
        "created_at"    timestamptz  NOT NULL DEFAULT now(),
        "updated_at"    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
