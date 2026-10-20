import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { IAmendment } from '../../domain/types';
import { EEventResult, EEventType, EVENT_METRICS, IEventMetrics } from '../ports/EventMetrics';
import { ITaxLedgerRepository, TAX_LEDGER_REPOSITORY } from '../ports/TaxLedgerRepository';
import { TLogger } from '../types';

@Injectable()
export class AmendSaleCommand {
  public constructor(
    @Inject(TAX_LEDGER_REPOSITORY) private readonly repository: ITaxLedgerRepository,
    @Inject(EVENT_METRICS) private readonly metrics: IEventMetrics,
    @InjectPinoLogger(AmendSaleCommand.name) private readonly logger: TLogger,
  ) {}

  public async execute(amendment: IAmendment): Promise<void> {
    const inserted = await this.repository.insertAmendmentIfAbsent(amendment);
    const result = inserted ? EEventResult.RECORDED : EEventResult.DUPLICATE;
    this.metrics.countEvent(EEventType.AMENDMENT, result);
    this.logger.info(
      { invoiceId: amendment.invoiceId, itemId: amendment.itemId, date: amendment.date.toISOString() },
      inserted ? 'Amendment recorded' : 'Duplicate amendment ignored',
    );
    if (inserted) {
      await this.reportIfOrphaned(amendment);
    }
  }

  private async reportIfOrphaned(amendment: IAmendment): Promise<void> {
    const saleItemIds = await this.repository.findSaleItemIds(amendment.invoiceId);
    const saleIsRecorded = saleItemIds.length > 0;
    if (!saleIsRecorded || saleItemIds.includes(amendment.itemId)) {
      return;
    }

    this.metrics.countOrphanedAmendments(1);
    this.logger.warn(
      { invoiceId: amendment.invoiceId, orphanedItemIds: [amendment.itemId] },
      'Amendment targets an item missing from the sale and will not affect the tax position',
    );
  }
}
