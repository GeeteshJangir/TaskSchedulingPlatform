# Performance & Scalability Notes

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). Evidence gathered against the live
database (Neon PostgreSQL 16).

## Method

```bash
npx ts-node scripts/explain-hot-queries.ts
```

Runs `EXPLAIN (ANALYZE, BUFFERS)` on the platform's hot queries so index choices can be
verified rather than assumed.

## Hot query plans (verified)

| Query (frequency) | Plan | Index |
|---|---|---|
| Membership lookup — `WorkspaceMemberGuard`, **every** workspace request | Index Scan | `UQ_workspace_members_ws_user` |
| Task list (keyset, per project) | Index Scan **Backward** + Limit | `IDX_tasks_project_created (project_id, created_at, id)` |
| Notification inbox (keyset, per user) | Index Scan **Backward** + Limit | `IDX_notifications_recipient_created` |
| Unread notifications / badge | partial index (at scale) | `IDX_notifications_unread` *(M12)* |
| Reminder scan (open + overdue) | partial index (at scale) | `IDX_tasks_due_open (due_date) WHERE status NOT IN (DONE,CANCELLED)` |

Every keyset list query uses a composite index whose column order **matches the
`ORDER BY`** (`<scope>, created_at, id`), so a page is an index range scan + `LIMIT` —
no sort node, no `OFFSET`.

## Tuned index added — M12

`EXPLAIN` showed the unread query using the recipient index and then
`Filter: (NOT is_read)`. M12 adds a **partial** index over only unread rows, already in
keyset order:

```sql
CREATE INDEX "IDX_notifications_unread"
  ON "notifications" ("recipient_id", "created_at" DESC, "id" DESC)
  WHERE "is_read" = false;
```

This keeps the unread inbox + badge **O(unread)** even when a user has accumulated
thousands of *read* notifications.

## Note: sequential scans at small scale

On a single-heap-page table, PostgreSQL correctly prefers a **sequential scan** — reading
one page beats an index lookup. The partial indexes (`IDX_tasks_due_open`,
`IDX_notifications_unread`) are present and become the chosen plan once the tables grow
past that threshold. This is expected planner behaviour, not a missing index.

## Pagination audit

| Endpoint | Strategy | Backing index |
|---|---|---|
| `GET /workspaces/:id/projects` | keyset `(created_at,id)` | `IDX_projects_workspace_created` |
| `GET …/tasks` | keyset | `IDX_tasks_project_created` |
| `GET …/comments` | keyset | `IDX_comments_task_created` |
| `GET …/tasks/:id/activity` | keyset | `IDX_task_activity_task_created` |
| `GET /notifications` | keyset (+ partial unread) | `IDX_notifications_recipient_created` / `IDX_notifications_unread` |
| `GET …/tasks/:id/subtree` | recursive CTE (bounded depth ≤ 5) | `IDX_tasks_parent_task_id` |

- `limit` is validated **1–100** (default 20); the cursor is an opaque base64 of
  `(created_at, id)`.
- **No `OFFSET` anywhere** → no deep-pagination cliff.
- Intentionally unpaginated: a user's own workspaces and a workspace's member list (small,
  bounded per-entity sets).

## Caching (P9.1)

Membership resolution — hit on every guarded request — is **cache-aside** (30s TTL,
positive-only, invalidated on role change/removal). In-memory store today; swap to a Redis
store (`cache-manager` + Redis) for multi-instance deployments without code changes.

## Other guardrails (P9.1)

- **Rate limiting** — global 120 req/min, 20 req/min on auth (anti brute-force).
- **`statement_timeout` 10s** + bounded pool (`poolSize` 10) so a pathological query can't
  pin a connection.
- **Async offload** — notification + reminder delivery run through BullMQ workers
  (`QUEUE_ENABLED`), keeping the request path free of fan-out work.
