import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe } from '@nestjs/common';
import { ETransactionEventType } from '../dto/enums';
import { SaleEventDto } from '../dto/SaleEventDto';
import { TaxPaymentEventDto } from '../dto/TaxPaymentEventDto';
import { VALIDATION_OPTIONS } from './validationOptions';

export type TTransactionEvent = SaleEventDto | TaxPaymentEventDto;

const DTO_BY_EVENT_TYPE: Record<ETransactionEventType, new () => TTransactionEvent> = {
  [ETransactionEventType.SALES]: SaleEventDto,
  [ETransactionEventType.TAX_PAYMENT]: TaxPaymentEventDto,
};

@Injectable()
export class TransactionEventPipe implements PipeTransform<unknown, Promise<TTransactionEvent>> {
  private readonly validationPipe = new ValidationPipe(VALIDATION_OPTIONS);

  public async transform(value: unknown, metadata: ArgumentMetadata): Promise<TTransactionEvent> {
    const eventType =
      typeof value === 'object' && value !== null ? (value as { eventType?: unknown }).eventType : undefined;
    if (!isTransactionEventType(eventType)) {
      throw new BadRequestException(`eventType must be one of: ${Object.values(ETransactionEventType).join(', ')}`);
    }
    return this.validationPipe.transform(value, { ...metadata, metatype: DTO_BY_EVENT_TYPE[eventType] });
  }
}

function isTransactionEventType(value: unknown): value is ETransactionEventType {
  return Object.values<unknown>(ETransactionEventType).includes(value);
}
