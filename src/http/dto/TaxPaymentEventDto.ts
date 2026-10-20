import { Equals } from 'class-validator';
import { IsIsoInstant, IsPence } from '../validation/decorators';
import { ETransactionEventType } from './enums';

export class TaxPaymentEventDto {
  @Equals(ETransactionEventType.TAX_PAYMENT)
  public readonly eventType!: ETransactionEventType.TAX_PAYMENT;

  @IsIsoInstant()
  public readonly date!: Date;

  @IsPence(1)
  public readonly amount!: number;
}
