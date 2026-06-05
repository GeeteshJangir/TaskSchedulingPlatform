import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Per-request logging with a correlation id. Ensures every request carries an
 * x-correlation-id (generated if absent) so logs and error envelopes line up.
 * Structured pino logging replaces this in Phase 10.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const correlationId = req.headers['x-correlation-id'] ?? randomUUID();
    req.headers['x-correlation-id'] = correlationId;

    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        this.logger.log(`[${correlationId}] ${method} ${url} ${ms}ms`);
      }),
    );
  }
}
