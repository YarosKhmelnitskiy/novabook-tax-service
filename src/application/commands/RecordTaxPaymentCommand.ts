import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger } from 'nestjs-pino';
import { ITaxPayment } from '../../domain/types';
import { EEventResult, EEventType, EVENT_METRICS, IEventMetrics } from '../ports/EventMetrics';
import { ITaxLedgerRepository, TAX_LEDGER_REPOSITORY } from '../ports/TaxLedgerRepository';
import { TLogger } from '../types';

@Injectable()
export class RecordTaxPaymentCommand {
  public constructor(
    @Inject(TAX_LEDGER_REPOSITORY) private readonly repository: ITaxLedgerRepository,
    @Inject(EVENT_METRICS) private readonly metrics: IEventMetrics,
    @InjectPinoLogger(RecordTaxPaymentCommand.name) private readonly logger: TLogger,
  ) {}

  public async execute(payment: ITaxPayment): Promise<void> {
    await this.repository.insertTaxPayment(payment);
    this.metrics.countEvent(EEventType.TAX_PAYMENT, EEventResult.RECORDED);
    this.logger.info({ amount: payment.amount.toString(), date: payment.date.toISOString() }, 'Tax payment recorded');
  }
}
