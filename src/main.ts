import 'reflect-metadata';
import './common/load-env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';

/**
 * API process: HTTP + (later) WebSocket. Serves the REST API and Swagger UI.
 */
async function bootstrapApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Task & Scheduling Platform API')
    .setDescription(
      'Collaborative task management — workspaces, projects, nested tasks, ' +
        'comments, reminders and notifications. NestJS modular monolith.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Signup, login, refresh, logout')
    .addTag('workspaces', 'Workspaces, members, invitations, RBAC')
    .addTag('projects')
    .addTag('tasks', 'Tasks, nested subtasks, assignment')
    .addTag('comments')
    .addTag('activity')
    .addTag('notifications')
    .addTag('reminders')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Multi-instance realtime: back Socket.IO with Redis pub/sub when configured.
  // Single-instance dev uses the default in-memory adapter.
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { RedisIoAdapter } = await import('./modules/realtime/redis-io.adapter');
    const adapter = new RedisIoAdapter(app, redisUrl);
    await adapter.connect();
    app.useWebSocketAdapter(adapter);
    Logger.log('Socket.IO: Redis adapter enabled', 'Bootstrap');
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(
    `API ready on http://localhost:${port}/api  (Swagger: /docs)`,
    'Bootstrap',
  );
}

/**
 * Worker process: no HTTP server. Hosts the cron scheduler and BullMQ queue
 * consumers (registered from Phase 6/7). Same codebase, different run mode.
 */
async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  Logger.log(
    'Worker context started. Queue consumers + cron will register here (Phase 6/7).',
    'Bootstrap',
  );
  // Keep the event loop alive until BullMQ workers provide their own handles.
  setInterval(() => undefined, 1 << 30);
}

async function bootstrap(): Promise<void> {
  const runMode = process.env.RUN_MODE ?? 'api';
  if (runMode === 'worker') {
    await bootstrapWorker();
  } else {
    await bootstrapApi();
  }
}

void bootstrap();
