import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { HasUniqueItemIds, IsIsoInstant, IsPence, IsTaxRate } from '../validation/decorators';
import { ETransactionEventType } from './enums';

export class SaleItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  public readonly itemId!: string;

  @IsPence(0)
  public readonly cost!: number;

  @IsTaxRate()
  public readonly taxRate!: number;
}

export class SaleEventDto {
  @Equals(ETransactionEventType.SALES)
  public readonly eventType!: ETransactionEventType.SALES;

  @IsIsoInstant()
  public readonly date!: Date;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  public readonly invoiceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @HasUniqueItemIds()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  public readonly items!: SaleItemDto[];
}
