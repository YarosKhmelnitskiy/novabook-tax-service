import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidTaxRateError } from './errors';
import { TaxRate } from './TaxRate';

describe('Domain | TaxRate', () => {
  describe('isValidFraction', () => {
    const cases: Array<{ value: unknown; expected: boolean }> = [
      { value: 0, expected: true },
      { value: 1, expected: true },
      { value: 0.2, expected: true },
      { value: 0.175, expected: true },
      { value: 0.08875, expected: true },
      { value: 0.000000001, expected: true },
      { value: 0.1234567891, expected: false },
      { value: 0.0000000015, expected: false },
      { value: -0.1, expected: false },
      { value: 1.01, expected: false },
      { value: Number.NaN, expected: false },
      { value: Number.POSITIVE_INFINITY, expected: false },
      { value: '0.2', expected: false },
      { value: null, expected: false },
    ];

    for (const { value, expected } of cases) {
      it(`returns ${expected} for ${String(value)}`, () => {
        assert.strictEqual(TaxRate.isValidFraction(value), expected);
      });
    }
  });

  describe('fromFraction', () => {
    it('stores the rate in billionths', () => {
      assert.strictEqual(TaxRate.fromFraction(0.175).billionths, 175_000_000n);
    });

    it('rejects a rate it cannot store exactly', () => {
      assert.throws(() => TaxRate.fromFraction(0.1234567891), InvalidTaxRateError);
    });
  });

  describe('fromBillionths', () => {
    it('rejects a value above 100%', () => {
      assert.throws(() => TaxRate.fromBillionths(1_000_000_001n), InvalidTaxRateError);
    });
  });

  describe('taxOn', () => {
    const cases: Array<{ cost: bigint; rate: number; expected: bigint }> = [
      { cost: 1099n, rate: 0.2, expected: 220n },
      { cost: 180n, rate: 0.175, expected: 32n },
      { cost: 1000n, rate: 0.08875, expected: 89n },
      { cost: 1n, rate: 0.5, expected: 1n },
      { cost: 1n, rate: 0.49, expected: 0n },
      { cost: 0n, rate: 0.2, expected: 0n },
      { cost: 1000n, rate: 0, expected: 0n },
      { cost: 9_007_199_254_740_991n, rate: 1, expected: 9_007_199_254_740_991n },
    ];

    for (const { cost, rate, expected } of cases) {
      it(`rounds ${cost} x ${rate} half up to ${expected}`, () => {
        assert.strictEqual(TaxRate.fromFraction(rate).taxOn(cost), expected);
      });
    }
  });
});
