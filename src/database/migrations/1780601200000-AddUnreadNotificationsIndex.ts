import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * M12 — partial index for the unread inbox / badge count. EXPLAIN showed the
 * unread query using the recipient index then filtering NOT is_read; a partial
 * index over only unread rows (already ordered for keyset paging) keeps that
 * query fast even when a user has accumulated many read notifications.
 */
export class AddUnreadNotificationsIndex1780601200000
  implements MigrationInterface
{
  name = 'AddUnreadNotificationsIndex1780601200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_unread" ON "notifications" ("recipient_id", "created_at" DESC, "id" DESC) WHERE "is_read" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_notifications_unread"`);
  }
}
