import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Runtime database wiring. Accepts either a single DATABASE_URL (Neon/managed)
 * or discrete DB_* fields. Entities are auto-loaded as feature modules register
 * them. synchronize is always false — schema is owned by migrations.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        const ssl = config.get<boolean>('database.ssl')
          ? { rejectUnauthorized: false }
          : false;

        return {
          type: 'postgres' as const,
          ...(url
            ? { url }
            : {
                host: config.get<string>('database.host'),
                port: config.get<number>('database.port'),
                username: config.get<string>('database.username'),
                password: config.get<string>('database.password'),
                database: config.get<string>('database.name'),
              }),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          logging: config.get<boolean>('database.logging'),
          ssl,
          // Resilience: retry a few times so the API can start alongside a
          // warming Postgres container.
          retryAttempts: 10,
          retryDelay: 3000,
          // Scalability guardrails: bounded pool + a per-statement timeout so a
          // pathological query can't pin a connection indefinitely.
          poolSize: 10,
          extra: {
            statement_timeout: 10_000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
