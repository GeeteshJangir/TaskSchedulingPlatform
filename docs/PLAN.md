# Phased Implementation Plan

> Deliverable: phased build plan
> Status: Pre-implementation (no code written yet)
> Last updated: 2026-06-05

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md) and [ERD.md](./ERD.md).

Each phase is a **vertical slice** — schema + API + guards + tests for that capability —
so every phase ends in something demonstrable via Swagger. A phase ships only when its
**Exit Criteria** are met (the per-phase Definition of Done). Testing is woven into each
phase, not bolted on at the end.

---

## Phase Overview

| Phase | Goal | Key Deliverables | Exit Criteria (DoD) | Evaluation weight |
|---|---|---|---|---|
| **P0 — Scaffold & Infra** | Bootable skeleton | Nest app; validated `ConfigModule`; TypeORM datasource + `migrate` container; Docker Compose (api, worker, postgres, redis, migrate); `CommonModule` (global ValidationPipe, exception filter, pagination, logging interceptor); Swagger; CI skeleton | `docker compose up` → api+db+redis healthy; `/health` green; Swagger served; M0 runs clean | Docker (High) |
| **P1 — Auth & Users** | Identity | M1; signup/login/refresh/logout; argon2 hashing; JWT strategy + `JwtAuthGuard`; refresh rotation + reuse detection | Full auth flow in Swagger; protected route → 401 without token; replayed refresh token → whole family revoked; unit tests on token service | RBAC/Auth (Med) |
| **P2 — Workspaces & RBAC** | Multi-tenant access control | M2; create workspace (owner→ADMIN); invite/accept; manage members & roles; `WorkspaceMemberGuard` + `RolesGuard` + `@Roles`/`@CurrentUser` | Permission matrix enforced (MEMBER admin-action → 403); cross-workspace access blocked; invitation lifecycle works; unit tests on guards + matrix | Backend arch (High), RBAC (Med) |
| **P3 — Projects** | Workspace contents | M3; project CRUD scoped by workspace + RBAC; keyset pagination | CRUD + RBAC + pagination; cannot read another workspace's projects; tests | PG modeling (High) |
| **P4 — Tasks & Subtasks** | Core domain | M4; task CRUD; assignment, status, priority, due date; self-ref subtasks via recursive CTE; depth + cycle guards; filtering/sorting/keyset pagination; emit domain events (no consumers yet) | Nested subtree creates + fetches in one query; cycle prevented (400); filters/sort work; events logged; tests incl. recursion edge cases | PG modeling (High), Backend arch (High) |
| **P5 — Comments & Activity** | Collaboration + audit | M5, M6; threaded comments (self-ref replies); activity log written by event listeners (append-only); paginated feed | Comment/reply works; every task mutation writes an activity row; feed paginated; tests | PG modeling (High) |
| **P6 — Async Backbone & Notifications** | Decoupled side-effects | M7; BullMQ + Redis; worker run-mode; event listeners → enqueue jobs → worker persists notifications; read/unread endpoints; idempotency keys; retry + backoff + DLQ | Assigning a task → notification created by the worker; failed job retries then DLQs; worker scales as a separate container | Async (High), Backend arch (High) |
| **P7 — Scheduler & Reminders** | Time-driven workflow | M8; cron scan job (worker); idempotent reminder rows; due-soon/overdue detection → enqueue send-reminder → mark sent/failed | Task due within window → exactly one reminder + notification; re-running scan never duplicates (UQ proves it); failed send retries then DLQ; tests on idempotency | Async (High) |
| **P8 — Realtime** (bonus) | Live push | Socket.IO gateway w/ JWT handshake, per-user rooms, Redis adapter | Client receives notification live on assignment/reminder across ≥2 api replicas | Bonus |
| **P9 — Scalability Hardening** | Make it fast | Redis cache-aside for membership/role + invalidation; `EXPLAIN ANALYZE` hot queries; M9 tuned indexes; throttler; statement timeouts; pagination audit | Membership lookup cache-hit on repeat; hot queries show index scans (attach plans); rate limits active | Scalability (Med) |
| **P10 — Observability, Tests, Docs, CI/CD** | Production polish | `nestjs-pino` + correlation IDs; Terminus health (db/redis/queue) + Prometheus metrics; finalize Swagger; e2e via Testcontainers; GitHub Actions: lint→test→migrate up+down check→build image; README + architecture doc + ER diagram + setup | CI green; e2e covers auth→workspace→task→reminder end-to-end; all required deliverables present | Code quality, Docs, Error handling (Med) |

---

## Sequencing Rationale

- **P6 precedes P7** — reminders ride on the notification pipeline built in P6.
- **Correctness before speed** — caching/indexing (P9) comes after the features work, so
  we tune against real query plans, not guesses.
- **P8 is optional/parallelizable** — realtime is a bonus and depends only on P6; it can
  slip without blocking the critical path.
- Each phase is independently demoable, so progress is always provable.

## Critical-Path Dependency View

```
P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P9 → P10
                                  └→ P8 (bonus, parallel)
```

---

## Definition of Done (applies to every phase)

1. Migrations for the phase run clean (`up`) and revert clean (`down`).
2. Endpoints documented in Swagger with DTO validation.
3. RBAC enforced where applicable; unauthorized paths return correct 401/403.
4. Unit tests for the phase's core logic; critical paths covered by e2e by P10.
5. No `synchronize` usage; no secrets in code; config validated at boot.
6. Demonstrable via `docker compose up` + Swagger (evidence over assertion).
