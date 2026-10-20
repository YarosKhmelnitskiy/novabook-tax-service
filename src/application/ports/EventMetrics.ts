export const EVENT_METRICS = Symbol('EVENT_METRICS');

export enum EEventType {
  SALES = 'sales',
  TAX_PAYMENT = 'tax_payment',
  AMENDMENT = 'amendment',
}

export enum EEventResult {
  RECORDED = 'recorded',
  DUPLICATE = 'duplicate',
  CONFLICT = 'conflict',
}

export const EVENT_RESULTS_BY_TYPE: ReadonlyArray<[EEventType, readonly EEventResult[]]> = [
  [EEventType.SALES, [EEventResult.RECORDED, EEventResult.DUPLICATE, EEventResult.CONFLICT]],
  [EEventType.TAX_PAYMENT, [EEventResult.RECORDED]],
  [EEventType.AMENDMENT, [EEventResult.RECORDED, EEventResult.DUPLICATE]],
];

export interface IEventMetrics {
  countEvent(type: EEventType, result: EEventResult): void;
  countOrphanedAmendments(count: number): void;
}
