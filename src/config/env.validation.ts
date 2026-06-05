import * as Joi from 'joi';

/**
 * Validates raw process.env at boot. The app refuses to start on invalid config
 * (fail-fast). Keep this in sync with .env.example and configuration.ts.
 *
 * Database connection can be supplied either as a single DATABASE_URL
 * (e.g. Neon / Supabase / RDS) or as discrete DB_* fields. When DATABASE_URL is
 * set, the discrete username/password/name become optional.
 */
const requiredUnlessUrl = Joi.string().when('DATABASE_URL', {
  is: Joi.exist(),
  then: Joi.optional(),
  otherwise: Joi.required(),
});

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  RUN_MODE: Joi.string().valid('api', 'worker').default('api'),
  PORT: Joi.number().port().default(3000),

  // Database
  DATABASE_URL: Joi.string().optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: requiredUnlessUrl,
  DB_PASSWORD: requiredUnlessUrl,
  DB_NAME: requiredUnlessUrl,
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),

  // Redis / queue (consumed from Phase 6)
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_URL: Joi.string().optional(),
  QUEUE_ENABLED: Joi.boolean().default(false),

  // Auth (consumed from Phase 1)
  JWT_ACCESS_SECRET: Joi.string().default('dev-access-secret-change-me'),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().default('dev-refresh-secret-change-me'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
});
