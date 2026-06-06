# Tasks & Progress Tracker

**Project:** Scalable Collaborative Task & Scheduling Platform (NestJS modular monolith)
**Last updated:** 2026-06-05

## 📊 Overall progress: ~96%  (72 / 75 items)

```
[███████████████████████████████░] 96%
```

| Phase | Status | Done |
|---|---|---|
| P0 — Scaffold & Infra | ✅ Complete | 10/10 |
| P1 — Auth & Users | ✅ Complete | 9/9 |
| P2 — Workspaces & RBAC | ✅ Complete | 9/9 |
| P3 — Projects | ✅ Complete | 4/4 |
| P4 — Tasks & Subtasks | ✅ Complete | 9/9 |
| P5 — Comments & Activity | ✅ Complete | 6/6 |
| P6 — Async Backbone & Notifications | ✅ Code-complete | 8/8 |
| P7 — Scheduler & Reminders | ✅ Code-complete | 6/6 |
| P8 — Realtime (bonus) | ✅ Complete | 3/3 |
| P9 — Scalability Hardening | ✅ Complete | 5/5 |
| P10 — Observability, Tests, Docs, CI/CD | 🟡 In progress | 3/6 |

**Health:** build ✅ · unit tests ✅ **51 passing** · migrations **M0–M6 applied to Neon** ✅ · live e2e (auth / RBAC / refresh / reuse) ✅

> Percentage = completed checklist items ÷ total items. Update the boxes below and the
> table above whenever a phase moves. Bonus phase (P8) is included in the total.

---

## P0 — Scaffold & Infra ✅ (10/10)
- [x] NestJS app + dual run-mode bootstrap (`RUN_MODE` api/worker)
- [x] ConfigModule + Joi env validation (fail-fast)
- [x] TypeORM datasource + DatabaseModule (`synchronize:false`)
- [x] CommonModule — global exception filter, correlation-id logging interceptor
- [x] Keyset pagination helpers
- [x] Health endpoints — liveness + readiness
- [x] Swagger / OpenAPI
- [x] Multi-stage Dockerfile (non-root)
- [x] docker-compose — postgres / redis / migrate / api / worker
- [x] CI skeleton + README + docs

## P1 — Auth & Users ✅ (9/9)
- [x] M0 extensions (pgcrypto, citext) + M1 `users`
- [x] User entity + UsersService (`passwordHash` select:false)
- [x] M2 `refresh_tokens` + entity
- [x] argon2 password hashing
- [x] JWT access strategy + `JwtAuthGuard` + `@CurrentUser`
- [x] signup / login / refresh / logout
- [x] refresh-token rotation + reuse detection (family revoke)
- [x] `GET /users/me` (protected)
- [x] unit tests (auth, refresh-token, users, duration)

## P2 — Workspaces & RBAC ✅ (9/9)
- [x] M3 `workspaces` + M4 `workspace_members` (+ role enum)
- [x] Workspace + WorkspaceMember entities (M2M + role)
- [x] WorkspacesService — create (owner→ADMIN in txn), list, member mgmt
- [x] `WorkspaceMemberGuard` + `RolesGuard` + `@Roles`
- [x] WorkspacesController (workspace + member endpoints)
- [x] M5 `workspace_invitations` (+ status enum, partial unique index)
- [x] InvitationsService — invite / accept (email-match, expiry) / revoke
- [x] InvitationsController (ADMIN-gated + accept-by-token)
- [x] unit tests (workspaces, guards, invitations)

## P3 — Projects ✅ (4/4)
- [x] M6 `projects` (+ status enum, composite keyset index)
- [x] ProjectsService — CRUD + keyset pagination + workspace scoping
- [x] ProjectsController — member view, ADMIN mutate
- [x] unit tests

## P4 — Tasks & Subtasks ✅ (9/9)
- [x] M7 `tasks` (self-ref `parent_task_id`, status/priority enums, assignee, due_date)
- [x] Task entity
- [x] TasksService — CRUD + assignment + status/priority/due-date
- [x] filtering + keyset pagination
- [x] recursive-CTE subtree fetch (`GET …/tasks/:id/subtree`, nested + depth)
- [x] cycle + depth guards (max depth 5; cycle prevention on re-parent via `…/move`)
- [x] domain events emitted (task.created / assigned / status_changed / completed)
- [x] TasksController
- [x] unit tests

## P5 — Comments & Activity ✅ (6/6)
- [x] M8 `comments` (self-ref replies) + entity
- [x] CommentsService + controller (threaded; author edits, author/ADMIN delete)
- [x] comments unit tests
- [x] M9 `task_activity` + entity (varchar+CHECK action, jsonb metadata)
- [x] activity listeners (consume task/comment events → audit rows)
- [x] activity feed (paginated, `GET …/tasks/:id/activity`)

## P6 — Async Backbone & Notifications ✅ (8/8)
- [x] M10 `notifications` + entity (per-user inbox, unread partial index)
- [x] read / unread endpoints (list, unread-count, mark-read, read-all)
- [x] unit tests (service + listeners + mappers + processor — 22 tests)
- [x] event-driven delivery (shared mappers; in-process **or** queue by config)
- [x] BullMQ + Redis wiring (QueueModule, config-gated by `QUEUE_ENABLED`)
- [x] worker run-mode queue consumers (`NotificationProcessor`)
- [x] queue delivery path + channel abstraction (in-app channel; pluggable)
- [x] idempotency (dedup jobId) + retry/backoff + DLQ (failed-set)
- ⏳ live queue/worker run pending Upstash Redis (in-process path verified live)

## P7 — Scheduler & Reminders ✅ (6/6)
- [x] M11 `reminders` + entity (idempotency unique key)
- [x] cron scan job (worker-gated `@Cron` + manual `POST /reminders/scan`)
- [x] due-soon / overdue detection (24h window; idempotent rows)
- [x] unit tests (scan + idempotency + processor)
- [x] send-reminder worker + mark sent/failed (`ReminderProcessor`, config-gated)
- [x] retry / backoff / DLQ (attempts=5 + exp backoff; FAILED on exhaustion)
- ⏳ live queue/worker run pending Upstash Redis (in-process path verified live)

## P8 — Realtime (bonus) ✅ (3/3)
- [x] Socket.IO gateway + JWT handshake (verified)
- [x] per-user rooms + config-gated Redis adapter (multi-instance ready)
- [x] live push on assignment / reminder (verified: assign → live TASK_ASSIGNED)

## P9 — Scalability Hardening ✅ (5/5)
- [x] cache-aside for membership/role + invalidation (in-memory; Redis-store ready)
- [x] throttler (global 120/min, auth 20/min) + statement_timeout (10s) + pool cap
- [x] EXPLAIN ANALYZE hot queries (verified index scans; docs/PERFORMANCE.md)
- [x] tuned partial index — M12 unread-notifications inbox/badge
- [x] pagination audit (all lists keyset + matching composite index; no OFFSET)

## P10 — Observability, Tests, Docs, CI/CD 🟡 (3/6)
- [x] pino structured logging + correlation IDs (genReqId, redaction)
- [x] Prometheus `/metrics` + DB health readiness (redis/queue health gated)
- [x] finalize Swagger (tags, descriptions, persistAuthorization)
- [ ] e2e tests (live DB) ← module 2
- [ ] CI: lint → test → migrate up/down → build ← module 2
- [ ] finalize README + architecture + ERD ← module 2

---

## 🔌 Environment / Database

- **Temporary:** Neon (serverless Postgres over TLS) via `DATABASE_URL` + `DB_SSL=true` —
  unblocks live migrations + verification without Docker.
- **Target:** Docker Compose (`docker compose up --build`) once Docker Desktop is installed.
- App supports both: a single `DATABASE_URL` (Neon) **or** discrete `DB_*` fields (compose).
- **Repo:** github.com/GeeteshJangir/TaskSchedulingPlatform (`main`). Commit per module/phase with conventional messages; `.env` is gitignored so the Neon secret stays local.

## ✅ Live verification — DONE on Neon (2026-06-05)
- [x] `npm run migration:run` applied M0–M6 (`migration:show` → all `[X]`); revert not yet exercised
- [x] App boots; `/api/health` readiness = `database: up`; Swagger at `/docs`
- [x] E2E happy path: signup → /users/me → create workspace (slug auto) → create project → keyset list
- [x] RBAC/auth negatives: non-member GET/POST → 403; no token → 401
- [x] Refresh rotation + reuse detection (replayed revoked token → 401)
- [x] Invite → accept over HTTP (User A invites → User B accepts as MEMBER)
- [x] MEMBER can create projects (post-tweak); DELETE still 403 (ADMIN-only)
- Note: Neon us-east-1 latency ~400–600 ms/query; readiness ping timeout raised to 5 s.

## 📝 Decisions / deviations from original plan
- M0 enables extensions only; enums created lazily in the migration that first needs them.
- Refresh tokens hashed with **SHA-256** (high-entropy → fast deterministic lookup); passwords use **argon2**.
- Refresh tokens are **opaque** (revocable), not JWTs.
- Test runner: `--runInBand` + `isolatedModules` (constrained-memory machine).
- **Projects: any member can create/edit; only ADMIN deletes** (P3 tweak; differs from the original ADMIN-only matrix, per request).

## 🛠️ How to maintain this file
1. Tick `[ ]` → `[x]` as items complete; flip the phase status emoji.
2. Recompute: overall % = (checked items ÷ 75) × 100; update the bar + header.
3. Keep "pending live verification" honest — only tick after a real run.
