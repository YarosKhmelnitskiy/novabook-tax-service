import { Inject, Injectable } from '@nestjs/common';
import { calculateTaxPosition } from '../../domain/calculateTaxPosition';
import { ITaxLedgerRepository, TAX_LEDGER_REPOSITORY } from '../ports/TaxLedgerRepository';

@Injectable()
export class GetTaxPositionQuery {
  public constructor(@Inject(TAX_LEDGER_REPOSITORY) private readonly repository: ITaxLedgerRepository) {}

  public async execute(at: Date): Promise<bigint> {
    return calculateTaxPosition(await this.repository.loadFactsUpTo(at));
  }
}
