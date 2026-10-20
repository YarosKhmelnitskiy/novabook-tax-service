import { Body, Controller, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { AmendSaleCommand } from '../application/commands/AmendSaleCommand';
import { AmendSaleDto } from './dto/AmendSaleDto';
import { toAmendment } from './mappers';

@Controller('sale')
export class SaleController {
  public constructor(private readonly amendSale: AmendSaleCommand) {}

  @Patch()
  @HttpCode(HttpStatus.ACCEPTED)
  public async amend(@Body() dto: AmendSaleDto): Promise<void> {
    await this.amendSale.execute(toAmendment(dto));
  }
}
