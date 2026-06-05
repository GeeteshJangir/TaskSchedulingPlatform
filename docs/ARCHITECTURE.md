# Architecture — Scalable Collaborative Task & Scheduling Platform

> Deliverable: Architecture explanation
> Status: Design (pre-implementation)
> Last updated: 2026-06-05

A production-oriented collaborative task management platform — workspaces, projects,
task assignment, nested subtasks, reminders, activity tracking, and notification
workflows — built as a **clean modular monolith** with an independently-scalable
async worker tier.

> The full database schema, ER diagram, and migration order live in
> [ERD.md](./ERD.md). The phased build sequence lives in [PLAN.md](./PLAN.md).

---

## 1. Architectural Style — Modular Monolith + Worker

```
                         ┌──────────────────────────────────────────┐
                         │              Single Codebase               │
                         │   (NestJS, one image, two run modes)        │
                         └──────────────────────────────────────────┘
                                    │                      │
                      run mode: API │                      │ run mode: WORKER
                                    ▼                      ▼
   Clients ──HTTP/WS──▶  ┌───────────────────┐   ┌───────────────────────┐
   (Swagger UI /          │   API process(es)  │   │   Worker process(es)   │
    minimal frontend)     │  Controllers/WS    │   │  Queue consumers +     │
                          │  Guards/Services   │   │  Cron scheduler        │
                          └─────────┬─────────┘   └───────────┬───────────┘
                                    │                          │
                 ┌──────────────────┼──────────────────────────┤
                 ▼                  ▼                          ▼
          ┌────────────┐    ┌──────────────┐          ┌──────────────┐
          │ PostgreSQL  │    │    Redis      │◀────────▶│   BullMQ      │
          │ (source of  │    │ (cache +      │  queues  │  (jobs over   │
          │   truth)    │    │  pub/sub)     │          │   Redis)      │
          └────────────┘    └──────────────┘          └──────────────┘
```

**Decision: one codebase, two runtime roles (API + Worker).** The same Docker image
boots either as the HTTP/WebSocket API or as a background worker (queue consumers +
cron), selected by an env flag / start command. This is the most important scalability
decision:

- The request path stays fast — anything slow (notifications, emails, reminder fan-out)
  is handed to the queue and returns immediately.
- API and workers **scale independently** (`replicas` in compose / k8s). A reminder
  storm scales workers without touching API capacity.
- It is still a monolith for dev simplicity — no service mesh, no cross-service
  contracts, one migration history, one deploy.

---

## 2. ADR — Monolith vs Microservices (Recommendation: Modular Monolith)

**Decision: build a modular monolith, not microservices.** Rationale:

1. **Microservices solve an *organizational* problem, not a technical one.** Their core
   driver is letting many independent teams deploy on their own cadence (Conway's Law).
   A small team building this product has no team-coordination pain to solve, so it would
   pay the entire microservices tax for a benefit it cannot use.
2. **The domain is deeply transactional and cohesive.** `workspace → project → task →
   subtask → comment → activity` are bound by foreign keys and need ACID transactions.
   Splitting them across services trades a single SQL transaction for distributed
   transactions / sagas / eventual consistency, and loses referential integrity.
3. **Scaling pressure is narrow and asymmetric.** Only the async tier (reminders,
   notifications, fan-out) genuinely needs independent scaling. The API/Worker split
   already provides exactly that — without splitting the domain into services.
4. **Cross-entity reads are common.** "Task with assignee + comments + subtree +
   activity" is one SQL join in a monolith; in microservices it becomes multiple network
   calls + data stitching + cross-service N+1 + partial-failure handling.
5. **Operational cost vs. payoff.** Microservices here means N pipelines, a gateway,
   service discovery, distributed tracing, schema-per-service, and saga orchestration —
   weeks of plumbing with no product value and a larger bug surface.
6. **It must be explainable and defensible.** A modular monolith is defensible
   end-to-end; a premature microservices design invites questions with no good answer at
   this scale (e.g. "why is auth a separate service with its own DB and a network hop?").

**When microservices *would* be the right call** (the boundary, for completeness):
multiple autonomous teams with independent deploy cadences; a component with a genuinely
different runtime profile that worker-replica scaling can't fix (e.g. a CPU-bound ML
service next to an IO-bound API); polyglot requirements; per-domain data-store/compliance
isolation; or a scale where the monolith's deploy blast-radius or build time becomes the
bottleneck. None apply here today.

**Evolutionary path.** Because the design uses clean module boundaries + domain events,
a service can be extracted later if metrics demand it. The natural first candidate is
**Notifications/Realtime** (already event-driven and async) — a strangler-fig extraction,
not a rewrite. This is "monolith first": right-size now, extract on evidence later.

---

## 3. Core Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| ORM | **TypeORM** | First-class NestJS integration, robust migrations, native tree entities for nested subtasks, strong QueryBuilder for recursive CTEs. |
| Queue | **BullMQ (Redis-backed)** | Native NestJS support, retries with exponential backoff, repeatable/cron jobs, rate limiting, dead-letter handling. |
| In-process decoupling | **EventEmitter2** | Domain events decouple core business logic from notification/activity side-effects. |
| Scheduler | **`@nestjs/schedule` cron** (in worker) + BullMQ repeatable jobs | Cron triggers the "scan for due tasks"; BullMQ carries the durable, retryable unit-of-work jobs. |
| Auth | **JWT access + rotating refresh tokens** (Passport) | Short-lived access JWT (~15 min) + long-lived refresh token (~7 d) stored hashed in DB for revocation + rotation + reuse detection. |
| Realtime (bonus) | **Socket.IO gateway** + Redis adapter | Live notification push; Redis adapter shares socket rooms across API replicas. |
| Password hashing | **argon2** (or bcrypt) | Memory-hard, modern default. |
| Caching | **Redis cache-aside** | Hot, read-heavy lookups (membership/role resolution, workspace/project metadata). |

---

## 4. Module Decomposition

NestJS modules map to bounded contexts. Each owns its entities, services, controllers,
DTOs, and domain events. Cross-module calls go through services — never another module's
raw repositories. Layering inside every feature module:
`Controller → Service → Repository(Entity)`, with DTOs + validation at the edge, guards
for access control, and domain events emitted from services.

### Feature modules
- **AuthModule** — signup, login, refresh, logout; JWT strategy; refresh-token
  rotation/revocation; password hashing.
- **UsersModule** — user profile, lookup; owns the `users` entity.
- **WorkspacesModule** — workspaces, memberships (RBAC source of truth), invitations.
- **ProjectsModule** — projects within a workspace.
- **TasksModule** — tasks, nested subtasks, status/priority/assignment, due dates.
- **CommentsModule** — task comments + threaded replies (self-referencing).
- **ActivityModule** — append-only task activity/audit log, populated by domain events.
- **NotificationsModule** — notification records + delivery; queue consumers; channel
  abstraction (in-app / email / realtime).
- **SchedulerModule** (worker) — cron scan for due tasks → emits reminder jobs.
- **RealtimeModule** (bonus) — Socket.IO gateway, auth handshake, per-user rooms.

### Platform / shared modules
- **CommonModule** — guards (`JwtAuthGuard`, `RolesGuard`, `WorkspaceMemberGuard`),
  interceptors (logging, transform), global exception filter, pagination helpers,
  decorators (`@CurrentUser`, `@Roles`, `@WorkspaceRole`).
- **ConfigModule** — `@nestjs/config` with schema validation (Joi/zod); fails fast.
- **DatabaseModule** — TypeORM datasource, pooling, migration wiring.
- **QueueModule** — BullMQ connection + queue registration.
- **CacheModule** — Redis cache-aside helpers + invalidation.
- **HealthModule** — Terminus `/health` (DB, Redis, queue) + Prometheus metrics (bonus).

---

## 5. Data Model (Summary)

Full schema, constraints, indexes, ER diagram, and migration order: **[ERD.md](./ERD.md)**.

Key relationships:
- User **1—M** Workspace (owner) and **M—M** Workspace via `workspace_members` (carries role).
- Workspace **1—M** Projects **1—M** Tasks.
- Task **1—M** Tasks (self-ref: subtasks); Task **M—1** User (assignee).
- Task **1—M** Comments **1—M** Comments (self-ref: replies).
- Task **1—M** TaskActivity, **1—M** Reminders.
- User **1—M** Notifications, **1—M** RefreshTokens.
- Task **M—M** Labels (optional).

This satisfies every required PostgreSQL concept: normalization, many-to-many,
self-referencing relations (×2), indexing strategy, and migrations.

### Nested subtasks — recursive strategy
**Decision: adjacency list (`parent_task_id`) as the model of record, read via a
PostgreSQL recursive CTE (`WITH RECURSIVE`).** Most normalized and the natural
TypeORM fit; the CTE fetches an entire subtree in one query and can compute depth /
roll-up counts. Guardrails: max-depth limit and cycle prevention (a task cannot become
its own ancestor; enforced by a `CHECK` + application check). If profiling later shows
subtree reads dominate, layer a **closure table** as a read-optimization without changing
the write model.

---

## 6. RBAC & Authentication

### Roles are workspace-scoped, not global
**Decision:** a user can be **ADMIN** of one workspace and **MEMBER** of another. The role
lives on `workspace_members.role`, not on `users`. An optional platform `SUPER_ADMIN` on
`users` can exist for ops but is not required.

### Permission matrix

| Action | ADMIN | MEMBER |
|---|---|---|
| View workspace / projects / tasks | yes | yes |
| Create / edit / delete projects | yes | no |
| Invite / remove members, change roles | yes | no |
| Delete workspace | yes (owner) | no |
| Create tasks & subtasks | yes | yes |
| Update any task | yes | own/assigned only |
| Comment | yes | yes |
| Edit / delete a comment | yes or author | author only |

### Guard pipeline (per request)
1. **JwtAuthGuard** — validates the access JWT (Passport JWT strategy), attaches `user`.
2. **WorkspaceMemberGuard** — resolves `workspaceId` from params/body, looks up
   membership, attaches the user's workspace role. Non-members → 403. (Redis-cached.)
3. **RolesGuard** — enforces `@Roles(ADMIN)` metadata against the resolved workspace role.
4. **Resource ownership** checks inside services for finer rules (e.g. comment author).

### Token lifecycle
- **Login** → access (15 min) + refresh (7 d). Refresh token stored hashed in
  `refresh_tokens`.
- **Refresh** → verify hash + not expired + not revoked → rotate (new pair, revoke old).
  A replayed, already-revoked token → reuse detected → revoke the whole token family.
- **Logout** → revoke the active refresh token.

---

## 7. Async Workflows

Two pillars — event-driven side-effects and a scheduled reminder pipeline — both flowing
through BullMQ for durability and retries.

### A. Domain events → notifications & activity
```
Service writes to DB
   └─ emits domain event (EventEmitter2): task.assigned / task.completed /
      comment.created / comment.replied
        ├─ ActivityListener     → writes task_activity row (audit)
        └─ NotificationListener  → enqueues BullMQ "notification" job
                                     │
                          Worker consumes job:
                            1. persist notification row
                            2. push via Socket.IO (realtime)
                            3. (optional) email channel
```
Emitting events keeps `TasksService` ignorant of notifications — new channels/side-effects
are added by registering listeners, not editing core logic (the "extensible architecture"
the brief asks for).

### B. Scheduler → reminders (cron + queue)
```
Cron (worker, every ~1–5 min)  →  enqueues "reminder-scan" job
   Worker (scan):
     SELECT tasks WHERE status NOT IN (DONE, CANCELLED)
       AND due_date BETWEEN now() AND now()+window
       AND NOT EXISTS matching reminder row     ← idempotent
     → INSERT reminder rows (unique constraint guards dupes)
     → enqueue one "send-reminder" job per reminder
   Worker (send-reminder):
     create notification → realtime push → mark reminder SENT
     on failure → BullMQ retry w/ exponential backoff
     attempts exhausted → mark FAILED + dead-letter queue
```

### Reliability properties
- **Idempotency** — `reminders` unique key `(task_id, type, scheduled_for)` means a
  re-run of the scan never double-notifies, even on double cron-fire or worker restart.
- **Retries** — BullMQ per-job `attempts` + exponential backoff ("retry failed jobs").
- **Dead-letter** — exhausted jobs land in a DLQ + `reminders.status = FAILED` for
  inspection/replay.
- **At-least-once + dedup** — the queue guarantees delivery; DB unique constraints
  guarantee effects happen once.

### Notification triggers
| Trigger | Event | Recipient |
|---|---|---|
| Task assignment | `task.assigned` | assignee |
| Due reminder | scheduler `reminder` | assignee (+ optional watchers) |
| Task completion | `task.completed` | creator + workspace admins |
| Comment / reply | `comment.created` / `comment.replied` | task assignee + parent-comment author |

---

## 8. Scalability

- **Pagination** — keyset/cursor pagination (`WHERE (created_at, id) < (:cursor)`) for
  tasks, activity, and notifications; offset pagination kept only for small admin lists.
- **Indexing** — partial + composite indexes target the actual hot queries (unread inbox,
  due-task scan). See [ERD.md](./ERD.md).
- **Query optimization** — relation loading via QueryBuilder to kill N+1; recursive CTE
  for subtrees; select only needed columns; `EXPLAIN ANALYZE` on the hot queries.
- **Caching (Redis, cache-aside)** — per-request membership/role resolution is the
  highest-frequency read (every guarded route hits it) → cache with short TTL, invalidate
  on member/role change. Also workspace/project metadata and notification unread counts.
- **Async offload** — request path never blocks on notification/email/reminder work.
- **Connection pooling** + statement timeouts; schema is read-replica-ready.
- **Rate limiting** — `@nestjs/throttler` on auth + write endpoints; payload size limits.
- **Independent scaling** — API replicas and worker replicas scale separately.

---

## 9. Docker / Deployment Topology

Multi-stage Dockerfile (deps → build → slim runtime), non-root user, single image reused
for API and worker.

| Service | Role | Notes |
|---|---|---|
| **api** | NestJS HTTP + WS | Exposed port; depends_on postgres+redis healthy |
| **worker** | Same image, worker command | Cron + queue consumers; `replicas` scalable; not exposed |
| **postgres** | Database | Named volume; healthcheck `pg_isready` |
| **redis** (optional/bonus) | Cache + BullMQ + Socket.IO adapter | Healthcheck `redis-cli ping` |
| **migrate** (one-shot) | Runs migrations then exits | Ensures schema current before api/worker start |
| **pgadmin / prometheus+grafana** (bonus) | Tooling/monitoring | Profile-gated |

Conventions: internal bridge network (only `api` published), env via `.env` (validated at
boot), `synchronize: false` everywhere — schema changes only through migrations,
healthcheck-gated `depends_on` so workers don't start against a cold DB.

---

## 10. Cross-Cutting Concerns

- **Validation** — global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`) with class-validator DTOs.
- **Error handling** — global exception filter → consistent error envelope
  (`statusCode`, `message`, `error`, `correlationId`); domain errors mapped to proper
  HTTP codes.
- **Logging/monitoring (bonus)** — `nestjs-pino` structured logs with per-request
  correlation IDs; Terminus `/health`; Prometheus metrics (latency, queue depth,
  job failures).
- **Config** — schema-validated env; fail fast.
- **API docs** — Swagger/OpenAPI auto-generated from DTOs + decorators; Swagger UI doubles
  as the minimal frontend / API explorer.
- **Testing (bonus)** — unit tests on services (RBAC matrix, reminder idempotency,
  recursive depth/cycle guard); e2e with Supertest against a throwaway Postgres
  (Testcontainers).
- **CI/CD (bonus)** — GitHub Actions: lint → test → build image → (push).

---

## 11. Proposed Folder Structure

```
src/
├─ main.ts                  # bootstraps API or WORKER per env flag
├─ app.module.ts
├─ common/                  # guards, interceptors, filters, decorators, pagination
├─ config/                  # validated env config
├─ database/                # datasource, migrations/
├─ modules/
│  ├─ auth/                 # controller, service, strategies, dto, refresh_token entity
│  ├─ users/
│  ├─ workspaces/           # + members, invitations
│  ├─ projects/
│  ├─ tasks/                # + subtasks logic, recursive queries
│  ├─ comments/
│  ├─ activity/             # event listeners → audit log
│  ├─ notifications/        # listeners + queue consumers + channels
│  ├─ scheduler/            # cron scan (worker)
│  └─ realtime/             # socket.io gateway (bonus)
├─ queue/                   # bullmq registration
└─ health/
test/                       # e2e
```

---

## 12. Mapping to Evaluation Criteria

| Criterion | Where addressed |
|---|---|
| Backend architecture (High) | Modular monolith + API/worker split, event-driven seams (§1, §4, §7) |
| PostgreSQL modeling (High) | Normalized schema, M2M, self-ref ×2, indexing, migrations ([ERD.md](./ERD.md)) |
| Async workflow design (High) | EventEmitter → BullMQ, cron scheduler, idempotent reminders, retries/DLQ (§7) |
| Docker/containerization (High) | Multi-stage image, api/worker/db/redis/migrate compose (§9) |
| RBAC/auth (Med) | Workspace-scoped roles, guard pipeline, rotating refresh tokens (§6) |
| Scalability (Med) | Keyset pagination, indexing, caching, async offload, independent scaling (§8) |
| Error handling / Code quality / Docs (Med) | Global filters, validation, Swagger, tests, logging (§10) |

---

## 13. Assumptions

1. **Workspace-scoped roles** (ADMIN/MEMBER per workspace), not a single global role.
2. **Single assignee per task** by default; multi-assignee is a clean extension via a
   `task_assignees` join.
3. **BullMQ + Redis** for queues (Redis moves from "optional" to "recommended" — the
   reminder/notification reliability story leans on it). A Redis-free fallback
   (in-process queue + DB-polling cron) is possible if Redis must stay strictly optional.
4. **TypeORM** over Sequelize.
