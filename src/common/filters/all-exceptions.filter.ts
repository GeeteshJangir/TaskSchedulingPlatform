import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * Global exception filter → consistent error envelope with a correlationId.
 * 5xx are logged with a stack trace; 4xx are returned quietly.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const correlationId =
      (req.headers['x-correlation-id'] as string) ?? randomUUID();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof raw === 'string'
        ? raw
        : ((raw as Record<string, unknown>).message ?? 'Error');
    const error =
      typeof raw === 'object'
        ? (raw as Record<string, unknown>).error
        : undefined;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] ${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error: error ?? HttpStatus[status],
      message,
      correlationId,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
