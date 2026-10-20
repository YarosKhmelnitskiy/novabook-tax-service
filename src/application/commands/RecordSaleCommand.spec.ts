import assert from 'node:assert/strict';
import { beforeEach, describe, it, Mock, mock } from 'node:test';
import { SaleConflictError } from '../../domain/errors';
import { TaxRate } from '../../domain/TaxRate';
import { ISale } from '../../domain/types';
import { EEventResult, EEventType, IEventMetrics } from '../ports/EventMetrics';
import { ESaleInsertStatus, ITaxLedgerRepository, TSaleInsertResult } from '../ports/TaxLedgerRepository';
import { TLogger } from '../types';
import { RecordSaleCommand } from './RecordSaleCommand';

type TMocked<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock<T[K]> : never };

const sale = (cost = 1000n): ISale => ({
  invoiceId: 'inv-1',
  date: new Date('2024-02-01T00:00:00Z'),
  items: [{ itemId: 'A', cost, taxRate: TaxRate.fromFraction(0.2) }],
});

const callsOf = <F extends (...args: never[]) => unknown>(fn: Mock<F>): unknown[][] =>
  fn.mock.calls.map((call) => call.arguments);

describe('Application | RecordSaleCommand', () => {
  let repository: TMocked<ITaxLedgerRepository>;
  let metrics: TMocked<IEventMetrics>;
  let warn: Mock<TLogger['warn']>;
  let command: RecordSaleCommand;

  const storedSaleIs = (result: TSaleInsertResult): void => {
    repository.insertSaleIfAbsent.mock.mockImplementation(async () => result);
  };

  beforeEach(() => {
    repository = {
      insertSaleIfAbsent: mock.fn<ITaxLedgerRepository['insertSaleIfAbsent']>(),
      insertTaxPayment: mock.fn<ITaxLedgerRepository['insertTaxPayment']>(),
      insertAmendmentIfAbsent: mock.fn<ITaxLedgerRepository['insertAmendmentIfAbsent']>(),
      findAmendedItemIds: mock.fn<ITaxLedgerRepository['findAmendedItemIds']>(async () => []),
      findSaleItemIds: mock.fn<ITaxLedgerRepository['findSaleItemIds']>(async () => []),
      loadFactsUpTo: mock.fn<ITaxLedgerRepository['loadFactsUpTo']>(),
    };
    metrics = {
      countEvent: mock.fn<IEventMetrics['countEvent']>(),
      countOrphanedAmendments: mock.fn<IEventMetrics['countOrphanedAmendments']>(),
    };
    warn = mock.fn<TLogger['warn']>();
    command = new RecordSaleCommand(repository, metrics, { info: mock.fn(), warn });
  });

  it('counts a new sale as recorded', async () => {
    storedSaleIs({ status: ESaleInsertStatus.INSERTED });

    await command.execute(sale());

    assert.deepEqual(callsOf(metrics.countEvent), [[EEventType.SALES, EEventResult.RECORDED]]);
    assert.strictEqual(metrics.countOrphanedAmendments.mock.callCount(), 0);
  });

  it('counts amendments whose item is missing from the new sale', async () => {
    storedSaleIs({ status: ESaleInsertStatus.INSERTED });
    repository.findAmendedItemIds.mock.mockImplementation(async () => ['A', 'Z', 'Z']);

    await command.execute(sale());

    assert.deepEqual(callsOf(metrics.countOrphanedAmendments), [[2]]);
    assert.strictEqual(warn.mock.callCount(), 1);
  });

  it('accepts an identical repeat as a duplicate', async () => {
    storedSaleIs({ status: ESaleInsertStatus.ALREADY_EXISTS, existing: sale() });

    await command.execute(sale());

    assert.deepEqual(callsOf(metrics.countEvent), [[EEventType.SALES, EEventResult.DUPLICATE]]);
    assert.strictEqual(repository.findAmendedItemIds.mock.callCount(), 0);
  });

  it('rejects a repeat with different content', async () => {
    storedSaleIs({ status: ESaleInsertStatus.ALREADY_EXISTS, existing: sale() });

    await assert.rejects(command.execute(sale(999n)), SaleConflictError);
    assert.deepEqual(callsOf(metrics.countEvent), [[EEventType.SALES, EEventResult.CONFLICT]]);
  });
});
