import { Inject, Injectable } from '@nestjs/common';
import { Kysely, sql, Transaction } from 'kysely';
import {
  ESaleInsertStatus,
  ITaxLedgerRepository,
  TSaleInsertResult,
} from '../../application/ports/TaxLedgerRepository';
import { TaxRate } from '../../domain/TaxRate';
import { IAmendment, ISale, ITaxableItem, ITaxFacts, ITaxPayment } from '../../domain/types';
import { DATABASE, IDatabase } from './database';

@Injectable()
export class PostgresTaxLedgerRepository implements ITaxLedgerRepository {
  public constructor(@Inject(DATABASE) private readonly db: Kysely<IDatabase>) {}

  public async insertSaleIfAbsent(sale: ISale): Promise<TSaleInsertResult> {
    return this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('sales')
        .values({ invoiceId: sale.invoiceId, date: sale.date })
        .onConflict((conflict) => conflict.column('invoiceId').doNothing())
        .returning('invoiceId')
        .executeTakeFirst();

      if (inserted === undefined) {
        return { status: ESaleInsertStatus.ALREADY_EXISTS, existing: await this.findSale(trx, sale.invoiceId) };
      }

      await trx
        .insertInto('saleItems')
        .values(
          sale.items.map((item) => ({
            invoiceId: sale.invoiceId,
            itemId: item.itemId,
            cost: item.cost,
            taxRateE9: item.taxRate.billionths,
          })),
        )
        .execute();
      return { status: ESaleInsertStatus.INSERTED };
    });
  }

  public async insertTaxPayment(payment: ITaxPayment): Promise<void> {
    await this.db.insertInto('taxPayments').values({ date: payment.date, amount: payment.amount }).execute();
  }

  public async insertAmendmentIfAbsent(amendment: IAmendment): Promise<boolean> {
    const inserted = await this.db
      .insertInto('saleAmendments')
      .values({
        invoiceId: amendment.invoiceId,
        itemId: amendment.itemId,
        date: amendment.date,
        cost: amendment.cost,
        taxRateE9: amendment.taxRate.billionths,
      })
      .onConflict((conflict) => conflict.columns(['invoiceId', 'itemId', 'date', 'cost', 'taxRateE9']).doNothing())
      .returning('id')
      .executeTakeFirst();
    return inserted !== undefined;
  }

  public async findAmendedItemIds(invoiceId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('saleAmendments')
      .select('itemId')
      .where('invoiceId', '=', invoiceId)
      .orderBy('id')
      .execute();
    return rows.map((row) => row.itemId);
  }

  public async findSaleItemIds(invoiceId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('saleItems').select('itemId').where('invoiceId', '=', invoiceId).execute();
    return rows.map((row) => row.itemId);
  }

  public async loadFactsUpTo(at: Date): Promise<ITaxFacts> {
    return this.db
      .transaction()
      .setIsolationLevel('repeatable read')
      .execute(async (trx) => ({
        items: await this.loadItemsInEffectAt(trx, at),
        paymentsTotal: await this.sumPaymentsUpTo(trx, at),
      }));
  }

  private async findSale(trx: Transaction<IDatabase>, invoiceId: string): Promise<ISale> {
    const sale = await trx
      .selectFrom('sales')
      .select(['invoiceId', 'date'])
      .where('invoiceId', '=', invoiceId)
      .executeTakeFirstOrThrow();
    const items = await trx
      .selectFrom('saleItems')
      .select(['itemId', 'cost', 'taxRateE9'])
      .where('invoiceId', '=', invoiceId)
      .execute();
    return {
      invoiceId: sale.invoiceId,
      date: sale.date,
      items: items.map((item) => ({
        itemId: item.itemId,
        cost: item.cost,
        taxRate: TaxRate.fromBillionths(item.taxRateE9),
      })),
    };
  }

  private async loadItemsInEffectAt(trx: Transaction<IDatabase>, at: Date): Promise<ITaxableItem[]> {
    const rows = await trx
      .selectFrom('sales')
      .innerJoin('saleItems', 'saleItems.invoiceId', 'sales.invoiceId')
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('saleAmendments')
            .select(['saleAmendments.cost', 'saleAmendments.taxRateE9'])
            .whereRef('saleAmendments.invoiceId', '=', 'saleItems.invoiceId')
            .whereRef('saleAmendments.itemId', '=', 'saleItems.itemId')
            .where('saleAmendments.date', '<=', at)
            .orderBy('saleAmendments.date', 'desc')
            .orderBy('saleAmendments.id', 'desc')
            .limit(1)
            .as('latestAmendment'),
        (join) => join.onTrue(),
      )
      .select((eb) => [
        eb.fn.coalesce('latestAmendment.cost', 'saleItems.cost').as('cost'),
        eb.fn.coalesce('latestAmendment.taxRateE9', 'saleItems.taxRateE9').as('taxRateE9'),
      ])
      .where('sales.date', '<=', at)
      .execute();
    return rows.map((row) => ({ cost: row.cost, taxRate: TaxRate.fromBillionths(row.taxRateE9) }));
  }

  private async sumPaymentsUpTo(trx: Transaction<IDatabase>, at: Date): Promise<bigint> {
    const { total } = await trx
      .selectFrom('taxPayments')
      .select(sql<string>`coalesce(sum(amount), 0)`.as('total'))
      .where('date', '<=', at)
      .executeTakeFirstOrThrow();
    return BigInt(total);
  }
}
