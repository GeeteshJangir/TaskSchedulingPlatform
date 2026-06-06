# Task & Scheduling Platform

A production-oriented collaborative task-management platform — **workspaces, projects,
assignable tasks, recursively nested subtasks, threaded comments, an activity audit trail,
a due-task reminder scheduler, and notifications** delivered both in-app and in real time.

Built as a **NestJS modular monolith** with an independently-scalable async worker tier,
on **PostgreSQL + TypeORM**, with **BullMQ/Redis** for durable async work and **Socket.IO**
for live push.

> **Status:** feature-complete (phases P0–P10, incl. the realtime bonus). **109 unit tests
> + an e2e happy-path**, all verified against a live PostgreSQL. Progress detail in
> [Tasks.md](./Tasks.md).

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modular-monolith design, monolith-vs-microservices ADR, modules, RBAC, async workflows, Docker |
| [docs/ERD.md](docs/ERD.md) | Entities, ER diagram, constraints/indexes, migration plan |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | EXPLAIN-verified hot queries, indexing, pagination audit, caching |
| [docs/PLAN.md](docs/PLAN.md) | Phased implementation plan (P0–P10) |

## Features

- **Auth & RBAC** — signup/login, JWT access + **rotating refresh tokens with reuse
  detection**; **workspace-scoped** roles (ADMIN/MEMBER) enforced by guards.
- **Workspaces** — create, invite by email, accept-by-token, manage members/roles.
- **Projects** — per workspace, keyset-paginated.
- **Tasks** — assignment, due dates, priorities, statuses, **recursive subtasks**
  (adjacency list + `WITH RECURSIVE` subtree fetch, cycle + max-depth guards), filtering.
- **Comments** — threaded replies; author edits, author/ADMIN delete.
- **Activity** — append-only audit trail, built by consuming domain events.
- **Scheduler & reminders** — cron scan for due/overdue tasks, **idempotent** reminders,
  durable delivery with **retry/backoff + dead-letter**.
- **Notifications** — per-user inbox (assignment, due, completion, comments/replies) with
  read/unread; **live Socket.IO push**.
- **Scalability** — keyset pagination, EXPLAIN-verified indexes, membership cache-aside,
  rate limiting, statement timeouts, async offload to workers.
- **Observability** — pino structured logging + correlation IDs, Prometheus `/metrics`,
  health checks, Swagger/OpenAPI.
- **Web client** — a minimal single-page UI at `/app` (served by the API process,
  same-origin, no build step): signup/login, workspace → project → task management,
  status/priority editing, and live Socket.IO notifications.

## Tech stack

NestJS · PostgreSQL · TypeORM (migrations) · Docker + Compose · JWT + refresh ·
RBAC · BullMQ + Redis · `@nestjs/schedule` cron · Socket.IO · `@nestjs/cache-manager` ·
`@nestjs/throttler` · nestjs-pino · Prometheus · Swagger · Jest.

## Architecture at a glance

One codebase, two run modes selected by `RUN_MODE`:

- **api** — HTTP/REST + Swagger + WebSocket gateway.
- **worker** — cron scheduler + BullMQ queue consumers. Scales independently of the API.

PostgreSQL is the source of truth; Redis carries cache + queues + the Socket.IO adapter.
Domain events (`task.assigned`, `comment.replied`, …) decouple side-effects: the activity
log and notifications subscribe rather than being called.

## Project structure

```
src/
├─ main.ts            # bootstraps API or WORKER per RUN_MODE
├─ config/            # typed config + Joi validation + pino logger config
├─ database/          # TypeORM datasource, DatabaseModule, migrations/ (M0–M12)
├─ common/            # exception filter, pagination, guards, decorators
├─ queue/             # BullMQ wiring (config-gated)
└─ modules/
   ├─ auth/ users/ workspaces/ projects/ tasks/
   ├─ comments/ activity/ notifications/ reminders/
   ├─ realtime/       # Socket.IO gateway + Redis adapter
   └─ health/
test/                 # e2e
scripts/              # dev utilities (EXPLAIN, realtime smoke)
docs/                 # architecture, ERD, performance, plan
```

## Getting started

### Option A — Docker (matches production)

```bash
cp .env.example .env
docker compose up --build
```

Starts `postgres`, `redis`, runs `migrate` (one-shot), then `api` + `worker`.

- **Web UI:**  http://localhost:3000/app  ← end-user client (sign in, manage tasks, live notifications)
- API:     http://localhost:3000/api
- Swagger:  http://localhost:3000/docs
- Metrics:  http://localhost:3000/api/metrics
- Health:   http://localhost:3000/api/health

### Option B — Local (Node 22) against any Postgres (incl. Neon)

```bash
npm install
# point .env at a database: DATABASE_URL=postgres://...  (set DB_SSL=true for Neon)
npm run migration:run        # apply M0–M12
npm run start:dev            # API (watch)
npm run start:worker:dev     # Worker (separate terminal)
```

## Environment

See [.env.example](.env.example). Config is validated at boot (Joi) — the app refuses to
start on invalid env. Key variables:

| Var | Purpose |
|---|---|
| `RUN_MODE` | `api` (default) or `worker` |
| `DATABASE_URL` *or* `DB_HOST/PORT/USERNAME/PASSWORD/NAME` | Postgres connection |
| `DB_SSL` | `true` for managed Postgres over TLS (Neon/RDS) |
| `QUEUE_ENABLED` + `REDIS_URL` | enable durable BullMQ delivery + Socket.IO Redis adapter |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `*_TTL` | token signing |
| `LOG_LEVEL` | pino level (default `info`) |

`DB_SYNCHRONIZE` stays `false` everywhere — schema changes go through migrations only.

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` / `start:worker:dev` | API / worker with hot reload |
| `npm test` | unit tests |
| `npm run test:e2e` | end-to-end happy path (needs Postgres + migrations) |
| `npm run migration:run` / `:revert` / `:generate` | migrations |
| `npx ts-node scripts/explain-hot-queries.ts` | EXPLAIN plans for the hot queries |
| `npx ts-node scripts/realtime-smoke.ts` | live realtime push check (server running) |

## Testing & CI

- **Unit:** 109 tests (services, guards, listeners, pagination, idempotency, RBAC).
- **E2E:** boots the whole app and walks signup → workspace → project → task → comment.
- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): build → unit → migrate →
  e2e, against a Postgres service.

## Operations (DevOps)

- **Make targets** (`make help`): `up`, `down`, `down-v`, `logs`, `ps`, `migrate`, `test`,
  `e2e`, `prod-up`, `prod-down`. *(Windows: run via Git Bash/WSL, or the underlying
  `docker compose` commands.)*
- **Production overrides** ([docker-compose.prod.yml](docker-compose.prod.yml)):
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` — adds
  restart policies, CPU/memory limits, JSON-file log rotation, a worker healthcheck, and
  **does not expose Postgres/Redis to the host**. `NODE_ENV=production` makes the app
  **reject the dev-default JWT secrets**, so real `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
  (≥32 chars) must be supplied.
- **CI/CD** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): build → unit → migrate →
  e2e; on `main`, build the image, **Trivy-scan** it (fail on fixable HIGH/CRITICAL), and
  push to **GHCR** (`:sha` + `:latest`).
- **Dependabot** ([.github/dependabot.yml](.github/dependabot.yml)): weekly npm + GitHub
  Actions + Docker updates.
- **Healthchecks**: api `/api/health/live` (liveness) and `/api/health` (readiness, pings DB);
  worker pings Redis. Compose gates startup on them.

## License

UNLICENSED — assignment submission.
