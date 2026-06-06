import { randomUUID } from 'crypto';
import { Params } from 'nestjs-pino';

/**
 * Structured (pino) logging. Every request gets a correlation id — reused from
 * an inbound x-correlation-id header or generated — which is attached to the
 * request, echoed on the response, and threaded through all logs (and the error
 * envelope). Sensitive fields are redacted.
 */
export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    genReqId: (req, res) => {
      const existing = req.headers['x-correlation-id'];
      const id =
        (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
      req.headers['x-correlation-id'] = id;
      res.setHeader('x-correlation-id', id as string);
      return id as string;
    },
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
    ],
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:standard' },
          }
        : undefined,
  },
};
