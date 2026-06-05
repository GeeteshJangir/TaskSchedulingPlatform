import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

/**
 * Standalone TypeORM DataSource used by the CLI for migrations
 * (generate / run / revert). The NestJS runtime uses DatabaseModule instead.
 *
 * Path resolution works in both worlds:
 *  - dev / CLI via ts-node  -> __filename ends in .ts -> scan ./src
 *  - compiled container      -> __filename ends in .js -> scan ./dist
 *
 * Connection: DATABASE_URL (Neon/managed) when present, else discrete DB_*.
 */
const isTs = __filename.endsWith('.ts');
const rootDir = isTs ? 'src' : 'dist';

const ssl =
  (process.env.DB_SSL ?? 'false') === 'true'
    ? { rejectUnauthorized: false }
    : false;

const shared = {
  entities: [join(process.cwd(), rootDir, '**', '*.entity.{ts,js}')],
  migrations: [
    join(process.cwd(), rootDir, 'database', 'migrations', '*.{ts,js}'),
  ],
  synchronize: false,
  logging: (process.env.DB_LOGGING ?? 'false') === 'true',
  ssl,
};

const options: DataSourceOptions = process.env.DATABASE_URL
  ? { type: 'postgres', url: process.env.DATABASE_URL, ...shared }
  : {
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'task_platform',
      ...shared,
    };

export const AppDataSource = new DataSource(options);
