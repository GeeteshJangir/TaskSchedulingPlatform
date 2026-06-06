# Ops shortcuts. (Windows: run via Git Bash / WSL, or invoke the commands directly.)
COMPOSE := docker compose
PROD    := docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: help up down down-v logs ps migrate test e2e build prod-up prod-down

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}'

up: ## Build + start the full stack (detached)
	$(COMPOSE) up --build -d

down: ## Stop the stack (keep data)
	$(COMPOSE) down

down-v: ## Stop the stack and DELETE the DB volume
	$(COMPOSE) down -v

logs: ## Tail api + worker logs
	$(COMPOSE) logs -f api worker

ps: ## Service status
	$(COMPOSE) ps

migrate: ## Run DB migrations (one-shot container)
	$(COMPOSE) run --rm migrate

build: ## Compile TypeScript
	npm run build

test: ## Unit tests
	npm test

e2e: ## End-to-end tests
	npm run test:e2e

prod-up: ## Start with production overrides (needs real secrets)
	$(PROD) up -d --build

prod-down: ## Stop the production stack
	$(PROD) down
