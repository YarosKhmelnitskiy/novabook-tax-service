import { TaxRate } from './TaxRate';

export interface ITaxableItem {
  cost: bigint;
  taxRate: TaxRate;
}

export interface ISaleItem extends ITaxableItem {
  itemId: string;
}

export interface ISale {
  invoiceId: string;
  date: Date;
  items: ISaleItem[];
}

export interface IAmendment extends ITaxableItem {
  invoiceId: string;
  itemId: string;
  date: Date;
}

export interface ITaxPayment {
  date: Date;
  amount: bigint;
}

export interface ITaxFacts {
  items: ITaxableItem[];
  paymentsTotal: bigint;
}
