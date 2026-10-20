import { Injectable } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { EEventResult, EEventType, EVENT_RESULTS_BY_TYPE, IEventMetrics } from '../../application/ports/EventMetrics';
import { EMetricLabel, EMetricName } from './enums';

export interface IHttpRequestObservation {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}

@Injectable()
export class MetricsService implements IEventMetrics {
  public readonly registry = new Registry();

  private readonly httpRequestDuration = new Histogram({
    name: EMetricName.HTTP_REQUEST_DURATION_SECONDS,
    help: 'HTTP request duration by route template',
    labelNames: [EMetricLabel.METHOD, EMetricLabel.ROUTE, EMetricLabel.STATUS_CODE],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  private readonly events = new Counter({
    name: EMetricName.EVENTS_TOTAL,
    help: 'Ingested events by type and outcome',
    labelNames: [EMetricLabel.EVENT_TYPE, EMetricLabel.RESULT],
    registers: [this.registry],
  });

  private readonly orphanedAmendments = new Counter({
    name: EMetricName.ORPHANED_AMENDMENTS_TOTAL,
    help: 'Amendments that target an item missing from the sale that arrived',
    registers: [this.registry],
  });

  public constructor() {
    collectDefaultMetrics({ register: this.registry });
    for (const [eventType, results] of EVENT_RESULTS_BY_TYPE) {
      for (const result of results) {
        this.events.inc({ [EMetricLabel.EVENT_TYPE]: eventType, [EMetricLabel.RESULT]: result }, 0);
      }
    }
  }

  public countEvent(type: EEventType, result: EEventResult): void {
    this.events.inc({ [EMetricLabel.EVENT_TYPE]: type, [EMetricLabel.RESULT]: result });
  }

  public countOrphanedAmendments(count: number): void {
    this.orphanedAmendments.inc(count);
  }

  public observeHttpRequest(observation: IHttpRequestObservation): void {
    this.httpRequestDuration.observe(
      {
        [EMetricLabel.METHOD]: observation.method,
        [EMetricLabel.ROUTE]: observation.route,
        [EMetricLabel.STATUS_CODE]: String(observation.statusCode),
      },
      observation.durationSeconds,
    );
  }
}
