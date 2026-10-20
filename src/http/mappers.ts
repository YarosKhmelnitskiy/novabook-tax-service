import { TaxRate } from '../domain/TaxRate';
import { IAmendment, ISale, ITaxPayment } from '../domain/types';
import { AmendSaleDto } from './dto/AmendSaleDto';
import { SaleEventDto } from './dto/SaleEventDto';
import { TaxPaymentEventDto } from './dto/TaxPaymentEventDto';

export function toSale(dto: SaleEventDto): ISale {
  return {
    invoiceId: dto.invoiceId,
    date: dto.date,
    items: dto.items.map((item) => ({
      itemId: item.itemId,
      cost: BigInt(item.cost),
      taxRate: TaxRate.fromFraction(item.taxRate),
    })),
  };
}

export function toTaxPayment(dto: TaxPaymentEventDto): ITaxPayment {
  return { date: dto.date, amount: BigInt(dto.amount) };
}

export function toAmendment(dto: AmendSaleDto): IAmendment {
  return {
    invoiceId: dto.invoiceId,
    itemId: dto.itemId,
    date: dto.date,
    cost: BigInt(dto.cost),
    taxRate: TaxRate.fromFraction(dto.taxRate),
  };
}

export function toResponseNumber(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`Tax position ${value} cannot be represented exactly as a JSON number`);
  }
  return result;
}
