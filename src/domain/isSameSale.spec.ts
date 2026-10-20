import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSameSale } from './isSameSale';
import { TaxRate } from './TaxRate';
import { ISale } from './types';

const baseSale = (): ISale => ({
  invoiceId: 'inv-1',
  date: new Date('2024-02-22T17:29:39Z'),
  items: [
    { itemId: 'A', cost: 1000n, taxRate: TaxRate.fromFraction(0.2) },
    { itemId: 'B', cost: 500n, taxRate: TaxRate.fromFraction(0.1) },
  ],
});

describe('Domain | isSameSale', () => {
  const cases: Array<{ name: string; change: (sale: ISale) => ISale; expected: boolean }> = [
    { name: 'matches an identical sale', change: (sale) => sale, expected: true },
    { name: 'ignores item order', change: (sale) => ({ ...sale, items: [...sale.items].reverse() }), expected: true },
    {
      name: 'compares dates as instants',
      change: (sale) => ({ ...sale, date: new Date('2024-02-22T19:29:39+02:00') }),
      expected: true,
    },
    {
      name: 'detects a different date',
      change: (sale) => ({ ...sale, date: new Date('2024-02-23T17:29:39Z') }),
      expected: false,
    },
    {
      name: 'detects a different cost',
      change: (sale) => ({ ...sale, items: [{ ...sale.items[0], cost: 999n }, sale.items[1]] }),
      expected: false,
    },
    {
      name: 'detects a different tax rate',
      change: (sale) => ({
        ...sale,
        items: [{ ...sale.items[0], taxRate: TaxRate.fromFraction(0.15) }, sale.items[1]],
      }),
      expected: false,
    },
    { name: 'detects a missing item', change: (sale) => ({ ...sale, items: [sale.items[0]] }), expected: false },
    {
      name: 'detects a replaced item',
      change: (sale) => ({ ...sale, items: [sale.items[0], { ...sale.items[1], itemId: 'C' }] }),
      expected: false,
    },
  ];

  for (const { name, change, expected } of cases) {
    it(name, () => {
      assert.strictEqual(isSameSale(baseSale(), change(baseSale())), expected);
    });
  }
});
