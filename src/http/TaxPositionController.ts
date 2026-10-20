import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { GetTaxPositionQuery } from '../application/queries/GetTaxPositionQuery';
import { ITaxPositionResponse, TaxPositionQueryDto } from './dto/TaxPositionDto';
import { toResponseNumber } from './mappers';

@Controller('tax-position')
export class TaxPositionController {
  public constructor(private readonly getTaxPosition: GetTaxPositionQuery) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  public async get(
    @Query() query: TaxPositionQueryDto,
    @Query('date') requestedDate: string,
  ): Promise<ITaxPositionResponse> {
    const taxPosition = await this.getTaxPosition.execute(query.date);
    return { date: requestedDate, taxPosition: toResponseNumber(taxPosition) };
  }
}
