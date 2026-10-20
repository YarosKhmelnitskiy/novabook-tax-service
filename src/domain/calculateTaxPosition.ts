import { ITaxFacts } from './types';

export function calculateTaxPosition(facts: ITaxFacts): bigint {
  const salesTax = facts.items.reduce((total, item) => total + item.taxRate.taxOn(item.cost), 0n);
  return salesTax - facts.paymentsTotal;
}
