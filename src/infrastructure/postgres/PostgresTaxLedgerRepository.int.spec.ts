import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Kysely } from 'kysely';
import { ESaleInsertStatus } from '../../application/ports/TaxLedgerRepository';
import { TaxRate } from '../../domain/TaxRate';
import { IAmendment, ISale } from '../../domain/types';
import { createTestDatabase, ITestDatabase, truncateAll } from '../../testing/database';
import { createDatabase, IDatabase } from './database';
import { migrateToLatest } from './migrateToLatest';
import { PostgresTaxLedgerRepository } from './PostgresTaxLedgerRepository';

const at = (day: string): Date => new Date(`2024-02-${day}T00:00:00Z`);

const sale = (invoiceId: string, day: string, cost = 1000n): ISale => ({
  invoiceId,
  date: at(day),
  items: [
    { itemId: 'A', cost, taxRate: TaxRate.fromFraction(0.2) },
    { itemId: 'B', cost: 500n, taxRate: TaxRate.fromFraction(0.08875) },
  ],
});

const byValue = <T extends string | bigint>(left: T, right: T): number => (left < right ? -1 : left > right ? 1 : 0);

const amendment = (day: string, cost: bigint, target: Partial<IAmendment> = {}): IAmendment => ({
  invoiceId: 'inv-1',
  itemId: 'A',
  date: at(day),
  cost,
  taxRate: TaxRate.fromFraction(0.2),
  ...target,
});

describe('Infrastructure | PostgresTaxLedgerRepository', () => {
  let testDatabase: ITestDatabase;
  let db: Kysely<IDatabase>;
  let repository: PostgresTaxLedgerRepository;

  const costsInEffectAt = async (day: string): Promise<bigint[]> => {
    const facts = await repository.loadFactsUpTo(at(day));
    return facts.items.map((item) => item.cost).sort(byValue);
  };

  before(async () => {
    testDatabase = await createTestDatabase();
    db = createDatabase(testDatabase.url);
    await migrateToLatest(db);
    repository = new PostgresTaxLedgerRepository(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  after(async () => {
    await db.destroy();
    await testDatabase.drop();
  });

  describe('insertSaleIfAbsent', () => {
    it('inserts a new sale with its items', async () => {
      const result = await repository.insertSaleIfAbsent(sale('inv-1', '01'));

      assert.deepEqual(result, { status: ESaleInsertStatus.INSERTED });
      const facts = await repository.loadFactsUpTo(at('01'));
      assert.deepEqual(
        facts.items.map((item) => [item.cost, item.taxRate.billionths]).sort(([left], [right]) => byValue(left, right)),
        [
          [500n, 88_750_000n],
          [1000n, 200_000_000n],
        ],
      );
    });

    it('returns the stored sale instead of inserting a second one', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));

      const result = await repository.insertSaleIfAbsent(sale('inv-1', '02', 1n));

      assert.strictEqual(result.status, ESaleInsertStatus.ALREADY_EXISTS);
      if (result.status === ESaleInsertStatus.ALREADY_EXISTS) {
        assert.strictEqual(result.existing.date.toISOString(), at('01').toISOString());
        assert.deepEqual(result.existing.items.map((item) => item.cost).sort(byValue), [500n, 1000n]);
      }
    });

    it('lets exactly one of two concurrent identical sales insert', async () => {
      const results = await Promise.all([
        repository.insertSaleIfAbsent(sale('inv-1', '01')),
        repository.insertSaleIfAbsent(sale('inv-1', '01')),
      ]);

      assert.deepEqual(results.map((result) => result.status).sort(byValue), [
        ESaleInsertStatus.ALREADY_EXISTS,
        ESaleInsertStatus.INSERTED,
      ]);
    });

    it('keeps costs above the safe integer range exact', async () => {
      const cost = 9_007_199_254_740_993n;
      await repository.insertSaleIfAbsent(sale('inv-1', '01', cost));

      assert.deepEqual(await costsInEffectAt('01'), [500n, cost]);
    });
  });

  describe('insertAmendmentIfAbsent', () => {
    it('ignores an identical amendment', async () => {
      assert.strictEqual(await repository.insertAmendmentIfAbsent(amendment('10', 500n)), true);
      assert.strictEqual(await repository.insertAmendmentIfAbsent(amendment('10', 500n)), false);
    });
  });

  describe('findAmendedItemIds', () => {
    it('lists the item of every amendment of the invoice', async () => {
      await repository.insertAmendmentIfAbsent(amendment('10', 500n));
      await repository.insertAmendmentIfAbsent(amendment('11', 500n, { itemId: 'Z' }));
      await repository.insertAmendmentIfAbsent(amendment('11', 500n, { invoiceId: 'inv-2' }));

      assert.deepEqual(await repository.findAmendedItemIds('inv-1'), ['A', 'Z']);
    });
  });

  describe('findSaleItemIds', () => {
    it('lists the items of a recorded sale and nothing for an unknown one', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));

      assert.deepEqual((await repository.findSaleItemIds('inv-1')).sort(), ['A', 'B']);
      assert.deepEqual(await repository.findSaleItemIds('inv-404'), []);
    });
  });

  describe('loadFactsUpTo', () => {
    it('loads only sales dated at or before the moment', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));
      await repository.insertSaleIfAbsent(sale('inv-2', '05', 2000n));

      assert.deepEqual(await costsInEffectAt('04'), [500n, 1000n]);
      assert.deepEqual(await costsInEffectAt('05'), [500n, 500n, 1000n, 2000n]);
    });

    it('sums the payments dated at or before the moment', async () => {
      await repository.insertTaxPayment({ date: at('03'), amount: 100n });
      await repository.insertTaxPayment({ date: at('03'), amount: 100n });
      await repository.insertTaxPayment({ date: at('07'), amount: 100n });

      assert.strictEqual((await repository.loadFactsUpTo(at('02'))).paymentsTotal, 0n);
      assert.strictEqual((await repository.loadFactsUpTo(at('03'))).paymentsTotal, 200n);
    });

    it('applies an amendment from its own date', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));
      await repository.insertAmendmentIfAbsent(amendment('10', 300n));

      assert.deepEqual(await costsInEffectAt('09'), [500n, 1000n]);
      assert.deepEqual(await costsInEffectAt('10'), [300n, 500n]);
    });

    it('applies an amendment dated before its sale from the sale date', async () => {
      await repository.insertAmendmentIfAbsent(amendment('01', 300n));
      await repository.insertSaleIfAbsent(sale('inv-1', '05'));

      assert.deepEqual(await costsInEffectAt('03'), []);
      assert.deepEqual(await costsInEffectAt('05'), [300n, 500n]);
    });

    it('ignores amendments of a missing item or a missing sale', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));
      await repository.insertAmendmentIfAbsent(amendment('02', 300n, { itemId: 'Z' }));
      await repository.insertAmendmentIfAbsent(amendment('02', 300n, { invoiceId: 'inv-404' }));

      assert.deepEqual(await costsInEffectAt('03'), [500n, 1000n]);
    });

    it('uses the latest amendment by date regardless of arrival', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));
      await repository.insertAmendmentIfAbsent(amendment('20', 50n));
      await repository.insertAmendmentIfAbsent(amendment('10', 300n));

      assert.deepEqual(await costsInEffectAt('15'), [300n, 500n]);
      assert.deepEqual(await costsInEffectAt('25'), [50n, 500n]);
    });

    it('breaks a date tie between amendments by arrival order', async () => {
      await repository.insertSaleIfAbsent(sale('inv-1', '01'));
      await repository.insertAmendmentIfAbsent(amendment('10', 300n));
      await repository.insertAmendmentIfAbsent(amendment('10', 700n));

      assert.deepEqual(await costsInEffectAt('12'), [500n, 700n]);
    });
  });
});
