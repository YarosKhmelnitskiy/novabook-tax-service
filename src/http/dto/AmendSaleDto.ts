import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsIsoInstant, IsPence, IsTaxRate } from '../validation/decorators';

export class AmendSaleDto {
  @IsIsoInstant()
  public readonly date!: Date;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  public readonly invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  public readonly itemId!: string;

  @IsPence(0)
  public readonly cost!: number;

  @IsTaxRate()
  public readonly taxRate!: number;
}
