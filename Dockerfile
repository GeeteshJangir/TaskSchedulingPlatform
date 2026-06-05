# syntax=docker/dockerfile:1

# ---- Builder: install all deps + compile TS -> dist ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- Prod deps: only runtime dependencies ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Runtime: slim, non-root. Reused by api / worker / migrate ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
USER node
EXPOSE 3000
# Default command; docker-compose overrides per service (api / worker / migrate).
CMD ["node", "dist/main.js"]
