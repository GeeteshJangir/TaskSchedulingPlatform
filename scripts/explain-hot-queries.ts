/**
 * Dev utility: prints EXPLAIN (ANALYZE) plans for the platform's hot queries,
 * so index choices can be verified against a real database.
 *   npx ts-node scripts/explain-hot-queries.ts
 */
import { AppDataSource } from '../src/database/data-source';

const ZERO = `'00000000-0000-0000-0000-000000000000'`;

const QUERIES: Array<{ name: string; sql: string }> = [
  {
    name: 'membership lookup (WorkspaceMemberGuard hot path)',
    sql: `SELECT * FROM workspace_members WHERE workspace_id=${ZERO} AND user_id=${ZERO}`,
  },
  {
    name: 'task list (keyset, per project)',
    sql: `SELECT * FROM tasks WHERE project_id=${ZERO} ORDER BY created_at DESC, id DESC LIMIT 21`,
  },
  {
    name: 'notification inbox (keyset, per user)',
    sql: `SELECT * FROM notifications WHERE recipient_id=${ZERO} ORDER BY created_at DESC, id DESC LIMIT 21`,
  },
  {
    name: 'unread notifications (list + badge count)',
    sql: `SELECT * FROM notifications WHERE recipient_id=${ZERO} AND is_read=false ORDER BY created_at DESC, id DESC LIMIT 21`,
  },
  {
    name: 'reminder scan (open + overdue tasks)',
    sql: `SELECT * FROM tasks WHERE due_date IS NOT NULL AND status NOT IN ('DONE','CANCELLED') AND due_date <= now()`,
  },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  for (const q of QUERIES) {
    const rows: Array<Record<string, string>> = await AppDataSource.query(
      `EXPLAIN (ANALYZE, BUFFERS) ${q.sql}`,
    );
    console.log(`\n===== ${q.name} =====`);
    console.log(rows.map((r) => r['QUERY PLAN']).join('\n'));
  }
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
