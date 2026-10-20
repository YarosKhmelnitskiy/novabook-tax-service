import { InvalidTaxRateError } from './errors';

const SCALE = 1_000_000_000n;
const SCALE_AS_NUMBER = 1_000_000_000;
const HALF_SCALE = SCALE / 2n;

export class TaxRate {
  private constructor(public readonly billionths: bigint) {}

  public static isValidFraction(value: unknown): value is number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return false;
    }
    return Math.round(value * SCALE_AS_NUMBER) / SCALE_AS_NUMBER === value;
  }

  public static fromFraction(value: number): TaxRate {
    if (!TaxRate.isValidFraction(value)) {
      throw new InvalidTaxRateError(value);
    }
    return new TaxRate(BigInt(Math.round(value * SCALE_AS_NUMBER)));
  }

  public static fromBillionths(billionths: bigint): TaxRate {
    if (billionths < 0n || billionths > SCALE) {
      throw new InvalidTaxRateError(`${billionths}e-9`);
    }
    return new TaxRate(billionths);
  }

  public taxOn(cost: bigint): bigint {
    return (cost * this.billionths + HALF_SCALE) / SCALE;
  }

  public equals(other: TaxRate): boolean {
    return this.billionths === other.billionths;
  }
}
