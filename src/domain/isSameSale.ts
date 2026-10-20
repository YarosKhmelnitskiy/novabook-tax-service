import { ISale } from './types';

export function isSameSale(left: ISale, right: ISale): boolean {
  if (
    left.invoiceId !== right.invoiceId ||
    left.date.getTime() !== right.date.getTime() ||
    left.items.length !== right.items.length
  ) {
    return false;
  }

  const rightItems = new Map(right.items.map((item) => [item.itemId, item]));
  return left.items.every((item) => {
    const other = rightItems.get(item.itemId);
    return other !== undefined && other.cost === item.cost && other.taxRate.equals(item.taxRate);
  });
}
