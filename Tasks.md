# Tasks & Progress Tracker

**Project:** Scalable Collaborative Task & Scheduling Platform (NestJS modular monolith)
**Last updated:** 2026-06-05

## 📊 Overall progress: ~43%  (32 / 75 items)

```
[██████████████░░░░░░░░░░░░░░░░░░] 43%
```

| Phase | Status | Done |
|---|---|---|
| P0 — Scaffold & Infra | ✅ Complete | 10/10 |
| P1 — Auth & Users | ✅ Complete | 9/9 |
| P2 — Workspaces & RBAC | ✅ Complete | 9/9 |
| P3 — Projects | ✅ Complete | 4/4 |
| P4 — Tasks & Subtasks | ⬜ Not started | 0/9 |
| P5 — Comments & Activity | ⬜ Not started | 0/6 |
| P6 — Async Backbone & Notifications | ⬜ Not started | 0/8 |
| P7 — Scheduler & Reminders | ⬜ Not started | 0/6 |
| P8 — Realtime (bonus) | ⬜ Not started | 0/3 |
| P9 — Scalability Hardening | ⬜ Not started | 0/5 |
| P10 — Observability, Tests, Docs, CI/CD | ⬜ Not started | 0/6 |

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

## P4 — Tasks & Subtasks ⬜ (0/9)  ← NEXT
- [ ] M7 `tasks` (self-ref `parent_task_id`, status/priority enums, assignee, due_date)
- [ ] Task entity
- [ ] TasksService — CRUD + assignment + status/priority/due-date
- [ ] filtering + keyset pagination
- [ ] recursive-CTE subtree fetch
- [ ] cycle + depth guards
- [ ] domain events emitted (task.assigned / completed / ...)
- [ ] TasksController
- [ ] unit tests

## P5 — Comments & Activity ⬜ (0/6)
- [ ] M `comments` (self-ref replies) + entity
- [ ] CommentsService + controller
- [ ] M `task_activity` + entity
- [ ] activity listeners (event-driven audit log)
- [ ] activity feed (paginated)
- [ ] unit tests

## P6 — Async Backbone & Notifications ⬜ (0/8)
- [ ] BullMQ + Redis wiring
- [ ] worker run-mode queue consumers
- [ ] M `notifications` + entity
- [ ] event listeners → enqueue notification jobs
- [ ] worker persists notifications + channel abstraction
- [ ] read / unread endpoints
- [ ] idempotency + retry/backoff + DLQ
- [ ] unit tests

## P7 — Scheduler & Reminders ⬜ (0/6)
- [ ] M `reminders` + entity (idempotency unique key)
- [ ] cron scan job (worker)
- [ ] due-soon / overdue detection → enqueue
- [ ] send-reminder worker + mark sent/failed
- [ ] retry / backoff / DLQ
- [ ] unit tests (idempotency)

## P8 — Realtime (bonus) ⬜ (0/3)
- [ ] Socket.IO gateway + JWT handshake
- [ ] per-user rooms + Redis adapter
- [ ] live push on assignment / reminder

## P9 — Scalability Hardening ⬜ (0/5)
- [ ] Redis cache-aside for membership/role + invalidation
- [ ] EXPLAIN ANALYZE hot queries
- [ ] tuned / partial indexes migration
- [ ] throttler + statement timeouts
- [ ] pagination audit

## P10 — Observability, Tests, Docs, CI/CD ⬜ (0/6)
- [ ] pino structured logging + correlation IDs
- [ ] Terminus health (db/redis/queue) + Prometheus metrics
- [ ] finalize Swagger
- [ ] e2e tests (live DB / Testcontainers)
- [ ] CI: lint → test → migrate up/down → build image
- [ ] finalize README + architecture + ERD

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
