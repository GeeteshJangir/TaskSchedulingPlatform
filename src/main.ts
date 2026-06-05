import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * API process: HTTP + (later) WebSocket. Serves the REST API and Swagger UI.
 */
async function bootstrapApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
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
    .setDescription('Collaborative task management — NestJS modular monolith')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

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
