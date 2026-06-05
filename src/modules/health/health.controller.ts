import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** Liveness — process is up. No external dependencies (used by Docker healthcheck). */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness — can the app serve traffic? Verifies the DB connection.
   * Timeout has headroom for remote managed Postgres (e.g. Neon cross-region);
   * a co-located DB responds in single-digit ms.
   */
  @Get()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 5000 }),
    ]);
  }
}
