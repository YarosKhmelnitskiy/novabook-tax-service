import { NextFunction, Request, Response } from 'express';
import { EInfrastructureRoute } from './enums';
import { MetricsService } from './MetricsService';

const UNMATCHED_ROUTE = 'unmatched';
const INFRASTRUCTURE_ROUTES = new Set<string>(Object.values(EInfrastructureRoute));

export interface IAccessLogger {
  info(details: object, message: string): void;
}

type TLoggedRequest = Request & { log?: IAccessLogger };

export function createHttpObservabilityMiddleware(
  metrics: MetricsService,
  fallbackLogger: IAccessLogger,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: TLoggedRequest, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const route = resolveRoute(req);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      metrics.observeHttpRequest({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationSeconds: durationMs / 1000,
      });
      if (!INFRASTRUCTURE_ROUTES.has(route)) {
        (req.log ?? fallbackLogger).info(
          { method: req.method, route, statusCode: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 },
          'Request completed',
        );
      }
    });
    next();
  };
}

function resolveRoute(req: Request): string {
  const routePath: unknown = req.route?.path;
  return typeof routePath === 'string' ? `${req.baseUrl}${routePath}` : UNMATCHED_ROUTE;
}
