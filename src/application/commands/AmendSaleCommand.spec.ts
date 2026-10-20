import assert from 'node:assert/strict';
import { beforeEach, describe, it, Mock, mock } from 'node:test';
import { TaxRate } from '../../domain/TaxRate';
import { IAmendment } from '../../domain/types';
import { EEventResult, EEventType, IEventMetrics } from '../ports/EventMetrics';
import { ITaxLedgerRepository } from '../ports/TaxLedgerRepository';
import { TLogger } from '../types';
import { AmendSaleCommand } from './AmendSaleCommand';

type TMocked<T> = { [K in keyof T]: T[K] extends (...args: never[]) => unknown ? Mock<T[K]> : never };

const amendment = (itemId = 'A'): IAmendment => ({
  invoiceId: 'inv-1',
  itemId,
  date: new Date('2024-02-10T00:00:00Z'),
  cost: 500n,
  taxRate: TaxRate.fromFraction(0.2),
});

const callsOf = <F extends (...args: never[]) => unknown>(fn: Mock<F>): unknown[][] =>
  fn.mock.calls.map((call) => call.arguments);

describe('Application | AmendSaleCommand', () => {
  let repository: TMocked<ITaxLedgerRepository>;
  let metrics: TMocked<IEventMetrics>;
  let warn: Mock<TLogger['warn']>;
  let command: AmendSaleCommand;

  const amendmentIsNew = (inserted: boolean): void => {
    repository.insertAmendmentIfAbsent.mock.mockImplementation(async () => inserted);
  };

  const saleHasItems = (itemIds: string[]): void => {
    repository.findSaleItemIds.mock.mockImplementation(async () => itemIds);
  };

  beforeEach(() => {
    repository = {
      insertSaleIfAbsent: mock.fn<ITaxLedgerRepository['insertSaleIfAbsent']>(),
      insertTaxPayment: mock.fn<ITaxLedgerRepository['insertTaxPayment']>(),
      insertAmendmentIfAbsent: mock.fn<ITaxLedgerRepository['insertAmendmentIfAbsent']>(),
      findAmendedItemIds: mock.fn<ITaxLedgerRepository['findAmendedItemIds']>(),
      findSaleItemIds: mock.fn<ITaxLedgerRepository['findSaleItemIds']>(async () => []),
      loadFactsUpTo: mock.fn<ITaxLedgerRepository['loadFactsUpTo']>(),
    };
    metrics = {
      countEvent: mock.fn<IEventMetrics['countEvent']>(),
      countOrphanedAmendments: mock.fn<IEventMetrics['countOrphanedAmendments']>(),
    };
    warn = mock.fn<TLogger['warn']>();
    command = new AmendSaleCommand(repository, metrics, { info: mock.fn(), warn });
  });

  it('counts a new amendment as recorded', async () => {
    amendmentIsNew(true);
    saleHasItems(['A']);

    await command.execute(amendment());

    assert.deepEqual(callsOf(metrics.countEvent), [[EEventType.AMENDMENT, EEventResult.RECORDED]]);
    assert.strictEqual(metrics.countOrphanedAmendments.mock.callCount(), 0);
  });

  it('does not treat an amendment as orphaned while its sale has not arrived', async () => {
    amendmentIsNew(true);

    await command.execute(amendment());

    assert.strictEqual(metrics.countOrphanedAmendments.mock.callCount(), 0);
  });

  it('counts an amendment of an item missing from the recorded sale', async () => {
    amendmentIsNew(true);
    saleHasItems(['A']);

    await command.execute(amendment('Z'));

    assert.deepEqual(callsOf(metrics.countOrphanedAmendments), [[1]]);
    assert.strictEqual(warn.mock.callCount(), 1);
  });

  it('does not count a duplicate amendment again', async () => {
    amendmentIsNew(false);
    saleHasItems(['A']);

    await command.execute(amendment('Z'));

    assert.deepEqual(callsOf(metrics.countEvent), [[EEventType.AMENDMENT, EEventResult.DUPLICATE]]);
    assert.strictEqual(repository.findSaleItemIds.mock.callCount(), 0);
  });
});
