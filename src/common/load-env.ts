import * as dotenv from 'dotenv';

/**
 * Loads .env into process.env at import time. Imported first in main.ts so that
 * module-load-time gates (e.g. QUEUE_ENABLED, RUN_MODE) can read env values
 * before feature module decorators are evaluated. ConfigModule also loads .env
 * for the typed config; loading twice is harmless.
 */
dotenv.config();
