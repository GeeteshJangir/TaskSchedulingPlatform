/**
 * Typed configuration factory. Loaded by ConfigModule and read via
 * ConfigService.get('database.host'), etc. Values are already validated by
 * env.validation.ts, so parsing here is safe.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  runMode: (process.env.RUN_MODE ?? 'api') as 'api' | 'worker',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    name: process.env.DB_NAME ?? 'task_platform',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
    logging: (process.env.DB_LOGGING ?? 'false') === 'true',
    ssl: (process.env.DB_SSL ?? 'false') === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  queue: {
    enabled: (process.env.QUEUE_ENABLED ?? 'false') === 'true',
    redisUrl: process.env.REDIS_URL || undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
});
