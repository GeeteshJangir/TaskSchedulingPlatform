# Full-Time Assignment

# Scalable Collaborative Task & Scheduling Platform

## Objective

Build a production-oriented collaborative task management platform with:

* workspaces
* projects
* task assignment
* nested subtasks
* reminders
* activity tracking
* notification workflows

Frontend can remain minimal.

Primary focus areas:

* Backend architecture
* PostgreSQL modeling
* Async systems
* Scalability thinking
* Docker/containerization

---

# Tech Stack Requirements

## Mandatory

* NestJS
* PostgreSQL
* Docker + Docker Compose
* JWT + Refresh Token Authentication
* Role-Based Access Control (RBAC)
* Background jobs/schedulers
* ORM ( TypeORM / Sequelize ) 

---

## Bonus 

* Redis
* BullMQ / RabbitMQ / Kafka
* Socket.IO
* Swagger/OpenAPI docs
* CI/CD setup
* Unit tests
* Monitoring/logging

---

# Core Features

## 1. Authentication & RBAC

Implement:

* Signup/Login
* Refresh token flow
* Protected routes
* Role-based permissions

### Roles

* ADMIN
* MEMBER

---

## 2. Workspaces

Users should be able to:

* Create workspace
* Invite members
* Manage members

---

## 3. Projects

Each workspace can contain multiple projects.

---

## 4. Tasks

Tasks should support:

* Assignment
* Due dates
* Priorities
* Statuses
* Comments
* Activity history

---

## 5. Nested Subtasks

Tasks should support recursive subtasks.

This feature is intentionally added to evaluate:

* Recursive schema design
* Hierarchical querying
* Backend modeling

---

## 6. Scheduler & Reminder System

The system should:

* Detect upcoming due tasks
* Generate reminders
* Retry failed jobs
* Process notifications asynchronously

You may use:

* Cron jobs
* Queue workers
* Async processing

---

## 7. Notifications

Generate notifications for:

* Task assignment
* Due reminders
* Task completion
* Comments/replies

---

# Scalability Expectations

Candidates are expected to think about:

* Pagination
* Indexing
* Query optimization
* Caching opportunities
* Async processing
* Extensible architecture

---

# PostgreSQL Expectations

Must demonstrate:

* Proper normalization
* Indexing strategy
* Many-to-many relationships
* Self-referencing relations
* Migrations
* Optimized querying

---

# Docker Requirements

docker-compose should run:

* Backend service
* PostgreSQL
* Optional Redis service

---

# Required Deliverables

Submit:

* GitHub repository
* README documentation
* Architecture explanation
* Setup instructions
* API documentation
* ER diagrams/schema design

---

# Evaluation Criteria

| Area                    | Weight |
| ----------------------- | ------ |
| Backend architecture    | High   |
| PostgreSQL modeling     | High   |
| Async workflow design   | High   |
| Docker/containerization | High   |
| RBAC/authentication     | Medium |
| Scalability thinking    | Medium |
| Error handling          | Medium |
| Code quality            | Medium |
| Documentation           | Medium |

Candidates are allowed to use AI-assisted development tools.
However, they are expected to fully understand and explain the architecture and implementation decisions made in the project.
