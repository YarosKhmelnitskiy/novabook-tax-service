import { Body, ConflictException, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RecordSaleCommand } from '../application/commands/RecordSaleCommand';
import { RecordTaxPaymentCommand } from '../application/commands/RecordTaxPaymentCommand';
import { SaleConflictError } from '../domain/errors';
import { SaleEventDto } from './dto/SaleEventDto';
import { toSale, toTaxPayment } from './mappers';
import { TransactionEventPipe, TTransactionEvent } from './validation/TransactionEventPipe';

@Controller('transactions')
export class TransactionsController {
  public constructor(
    private readonly recordSale: RecordSaleCommand,
    private readonly recordTaxPayment: RecordTaxPaymentCommand,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  public async ingest(@Body(TransactionEventPipe) event: TTransactionEvent): Promise<void> {
    if (event instanceof SaleEventDto) {
      await this.ingestSale(event);
      return;
    }
    await this.recordTaxPayment.execute(toTaxPayment(event));
  }

  private async ingestSale(event: SaleEventDto): Promise<void> {
    try {
      await this.recordSale.execute(toSale(event));
    } catch (error) {
      if (error instanceof SaleConflictError) {
        throw new ConflictException(
          `Sale ${error.invoiceId} is already recorded with different content; amend its items with PATCH /sale instead`,
        );
      }
      throw error;
    }
  }
}
