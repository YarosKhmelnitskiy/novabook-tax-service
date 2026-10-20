export class InvalidTaxRateError extends Error {
  public constructor(value: unknown) {
    super(`Tax rate must be a fraction between 0 and 1 with at most 9 decimal places, got ${String(value)}`);
    this.name = 'InvalidTaxRateError';
  }
}

export class SaleConflictError extends Error {
  public constructor(public readonly invoiceId: string) {
    super(`Sale ${invoiceId} is already recorded with different content`);
    this.name = 'SaleConflictError';
  }
}
