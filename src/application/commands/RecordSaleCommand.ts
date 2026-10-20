import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { SaleConflictError } from '../../domain/errors';
import { isSameSale } from '../../domain/isSameSale';
import { ISale } from '../../domain/types';
import { EEventResult, EEventType, EVENT_METRICS, IEventMetrics } from '../ports/EventMetrics';
import { ESaleInsertStatus, ITaxLedgerRepository, TAX_LEDGER_REPOSITORY } from '../ports/TaxLedgerRepository';
import { TLogger } from '../types';

@Injectable()
export class RecordSaleCommand {
  public constructor(
    @Inject(TAX_LEDGER_REPOSITORY) private readonly repository: ITaxLedgerRepository,
    @Inject(EVENT_METRICS) private readonly metrics: IEventMetrics,
    @InjectPinoLogger(RecordSaleCommand.name) private readonly logger: TLogger,
  ) {}

  public async execute(sale: ISale): Promise<void> {
    const result = await this.repository.insertSaleIfAbsent(sale);
    if (result.status === ESaleInsertStatus.ALREADY_EXISTS) {
      this.handleRepeatedSale(sale, result.existing);
      return;
    }

    this.metrics.countEvent(EEventType.SALES, EEventResult.RECORDED);
    this.logger.info(
      { invoiceId: sale.invoiceId, itemCount: sale.items.length, date: sale.date.toISOString() },
      'Sale recorded',
    );
    await this.reportOrphanedAmendments(sale);
  }

  private handleRepeatedSale(sale: ISale, existing: ISale): void {
    if (isSameSale(sale, existing)) {
      this.metrics.countEvent(EEventType.SALES, EEventResult.DUPLICATE);
      this.logger.info({ invoiceId: sale.invoiceId }, 'Duplicate sale ignored');
      return;
    }

    this.metrics.countEvent(EEventType.SALES, EEventResult.CONFLICT);
    this.logger.warn({ invoiceId: sale.invoiceId }, 'Sale conflicts with the recorded one');
    throw new SaleConflictError(sale.invoiceId);
  }

  private async reportOrphanedAmendments(sale: ISale): Promise<void> {
    const saleItemIds = new Set(sale.items.map((item) => item.itemId));
    const amendedItemIds = await this.repository.findAmendedItemIds(sale.invoiceId);
    const orphanedItemIds = amendedItemIds.filter((itemId) => !saleItemIds.has(itemId));
    if (orphanedItemIds.length === 0) {
      return;
    }

    this.metrics.countOrphanedAmendments(orphanedItemIds.length);
    this.logger.warn(
      { invoiceId: sale.invoiceId, orphanedItemIds: [...new Set(orphanedItemIds)] },
      'Amendments target items missing from the sale and will not affect the tax position',
    );
  }
}
