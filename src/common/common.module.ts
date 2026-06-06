import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * Cross-cutting concerns wired globally: the consistent error envelope.
 * Per-request logging + correlation ids are handled by nestjs-pino (see
 * config/logger.config.ts).
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class CommonModule {}
