import { Inject, Injectable, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TAX_LEDGER_REPOSITORY } from '../../application/ports/TaxLedgerRepository';
import { APP_CONFIG, IAppConfig } from '../../config/config';
import { createDatabase, DATABASE, IDatabase } from './database';
import { migrateToLatest } from './migrateToLatest';
import { PostgresTaxLedgerRepository } from './PostgresTaxLedgerRepository';

@Injectable()
class DatabaseLifecycle implements OnModuleInit, OnApplicationShutdown {
  public constructor(
    @Inject(DATABASE) private readonly db: Kysely<IDatabase>,
    @InjectPinoLogger(DatabaseLifecycle.name) private readonly logger: PinoLogger,
  ) {}

  public async onModuleInit(): Promise<void> {
    const applied = await migrateToLatest(this.db);
    this.logger.info({ applied }, 'Database migrations are up to date');
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [APP_CONFIG],
      useFactory: (config: IAppConfig): Kysely<IDatabase> => createDatabase(config.databaseUrl),
    },
    DatabaseLifecycle,
    { provide: TAX_LEDGER_REPOSITORY, useClass: PostgresTaxLedgerRepository },
  ],
  exports: [DATABASE, TAX_LEDGER_REPOSITORY],
})
export class PostgresModule {}
