import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M0 — enable required PostgreSQL extensions.
 *  - pgcrypto: gen_random_uuid() for UUID primary keys
 *  - citext:   case-insensitive text for emails / slugs
 * Enum types are created lazily in the migration that first needs them.
 */
export class InitExtensions1780600000000 implements MigrationInterface {
  name = 'InitExtensions1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "citext"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
  }
}
