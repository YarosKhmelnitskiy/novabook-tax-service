import { IAmendment, ISale, ITaxFacts, ITaxPayment } from '../../domain/types';

export const TAX_LEDGER_REPOSITORY = Symbol('TAX_LEDGER_REPOSITORY');

export enum ESaleInsertStatus {
  INSERTED = 'inserted',
  ALREADY_EXISTS = 'already_exists',
}

export type TSaleInsertResult =
  | { status: ESaleInsertStatus.INSERTED }
  | { status: ESaleInsertStatus.ALREADY_EXISTS; existing: ISale };

export interface ITaxLedgerRepository {
  insertSaleIfAbsent(sale: ISale): Promise<TSaleInsertResult>;
  insertTaxPayment(payment: ITaxPayment): Promise<void>;
  insertAmendmentIfAbsent(amendment: IAmendment): Promise<boolean>;
  findAmendedItemIds(invoiceId: string): Promise<string[]>;
  findSaleItemIds(invoiceId: string): Promise<string[]>;
  loadFactsUpTo(at: Date): Promise<ITaxFacts>;
}
