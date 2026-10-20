export enum EMetricName {
  HTTP_REQUEST_DURATION_SECONDS = 'novabook_tax_http_request_duration_seconds',
  EVENTS_TOTAL = 'novabook_tax_events_total',
  ORPHANED_AMENDMENTS_TOTAL = 'novabook_tax_orphaned_amendments_total',
}

export enum EMetricLabel {
  METHOD = 'method',
  ROUTE = 'route',
  STATUS_CODE = 'status_code',
  EVENT_TYPE = 'event_type',
  RESULT = 'result',
}

export enum EInfrastructureRoute {
  LIVENESS = '/health/liveness',
  READINESS = '/health/readiness',
  METRICS = '/metrics',
}
