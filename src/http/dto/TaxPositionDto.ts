import { IsDefined } from 'class-validator';
import { IsIsoInstant } from '../validation/decorators';

export class TaxPositionQueryDto {
  @IsDefined({ message: 'date query parameter is required' })
  @IsIsoInstant()
  public readonly date!: Date;
}

export interface ITaxPositionResponse {
  date: string;
  taxPosition: number;
}
