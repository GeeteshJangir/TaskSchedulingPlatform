# Task & Scheduling Platform

A production-oriented collaborative task management platform — workspaces, projects,
task assignment, nested subtasks, reminders, activity tracking, and notification
workflows. Built as a **NestJS modular monolith** with an independently-scalable async
worker tier, backed by PostgreSQL and (from Phase 6) Redis/BullMQ.

> Build status: **Phase 0 — scaffold & infrastructure**. Feature modules are added
> phase by phase. See [docs/PLAN.md](docs/PLAN.md).

## Documentation

| Doc | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modular-monolith design, monolith-vs-microservices ADR, modules, RBAC, async workflows, Docker, scalability |
| [docs/ERD.md](docs/ERD.md) | Entities, ER diagram, constraints/indexes, migration plan |
| [docs/PLAN.md](docs/PLAN.md) | Phased implementation plan (P0–P10) with exit criteria |

## Tech stack

NestJS · PostgreSQL · TypeORM (migrations) · Docker + Docker Compose ·
JWT + refresh tokens · RBAC · BullMQ + Redis (async) · `@nestjs/schedule` (cron) ·
Swagger/OpenAPI · Jest.

## Architecture at a glance

One codebase, two run modes selected by `RUN_MODE`:

- **api** — HTTP/REST (+ WebSocket later), Swagger UI, guards/services.
- **worker** — cron scheduler + BullMQ queue consumers. Scales independently of the API.

PostgreSQL is the source of truth; Redis carries cache + queues.

## Project structure

```
src/
├─ main.ts            # bootstraps API or WORKER per RUN_MODE
├─ app.module.ts
├─ config/            # typed config + Joi env validation
├─ database/          # TypeORM datasource, DatabaseModule, migrations/
├─ common/            # global filter, logging interceptor, pagination
└─ modules/
   └─ health/         # liveness + readiness
test/                 # e2e
docs/                 # architecture, ERD, plan
```

## Getting started

### Option A — Docker (recommended; matches production)

Requires Docker Desktop.

```bash
cp .env.example .env
docker compose up --build
```

This starts `postgres`, `redis`, runs `migrate` (one-shot), then `api` and `worker`.

- API:     http://localhost:3000/api
- Swagger:  http://localhost:3000/docs
- Health:   http://localhost:3000/api/health (readiness) · `/api/health/live` (liveness)

### Option B — Local (Node 22)

Requires a reachable PostgreSQL (set credentials in `.env`).

```bash
npm install
npm run build
npm run start:dev        # API with watch
npm run start:worker:dev # Worker with watch (separate terminal)
```

## NPM scripts

| Script | Purpose |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start:dev` | Run API with hot reload |
| `npm run start:worker:dev` | Run worker with hot reload |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs Postgres) |
| `npm run migration:generate -- src/database/migrations/<Name>` | Generate a migration from entity changes |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |

## Environment

See [.env.example](.env.example). Config is validated at boot (Joi) — the app refuses to
start on invalid env. `DB_SYNCHRONIZE` stays `false` everywhere; schema changes go through
migrations only.

## License

UNLICENSED — assignment submission.
