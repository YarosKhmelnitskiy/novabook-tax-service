import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTaxPosition } from './calculateTaxPosition';
import { TaxRate } from './TaxRate';
import { ITaxableItem } from './types';

const item = (cost: number, rate: number): ITaxableItem => ({
  cost: BigInt(cost),
  taxRate: TaxRate.fromFraction(rate),
});

describe('Domain | calculateTaxPosition', () => {
  const cases: Array<{ name: string; items: ITaxableItem[]; paymentsTotal: bigint; expected: bigint }> = [
    {
      name: 'is zero without facts',
      items: [],
      paymentsTotal: 0n,
      expected: 0n,
    },
    {
      name: 'sums the tax of every item',
      items: [item(1000, 0.2), item(500, 0.1), item(100, 0.2)],
      paymentsTotal: 0n,
      expected: 270n,
    },
    {
      name: 'subtracts payments and may go negative',
      items: [item(100, 0.2)],
      paymentsTotal: 50n,
      expected: -30n,
    },
    {
      name: 'rounds every item half up on its own',
      items: [item(1, 0.5), item(1, 0.5), item(1, 0.5)],
      paymentsTotal: 0n,
      expected: 3n,
    },
  ];

  for (const { name, items, paymentsTotal, expected } of cases) {
    it(name, () => {
      assert.strictEqual(calculateTaxPosition({ items, paymentsTotal }), expected);
    });
  }
});
