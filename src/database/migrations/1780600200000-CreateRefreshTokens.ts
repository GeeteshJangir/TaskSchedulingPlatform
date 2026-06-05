import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M2 — refresh_tokens. Stores a SHA-256 hash of each opaque refresh token
 * (high-entropy random secret → fast deterministic hash is appropriate and
 * enables O(1) lookup). family_id groups a rotation chain so reuse of a
 * revoked token can revoke the whole family.
 */
export class CreateRefreshTokens1780600200000 implements MigrationInterface {
  name = 'CreateRefreshTokens1780600200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    uuid         NOT NULL,
        "token_hash" varchar(64)  NOT NULL,
        "family_id"  uuid         NOT NULL,
        "expires_at" timestamptz  NOT NULL,
        "revoked_at" timestamptz,
        "user_agent" varchar(512),
        "ip"         inet,
        "created_at" timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_family_id"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
