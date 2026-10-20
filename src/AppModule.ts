import { DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AmendSaleCommand } from './application/commands/AmendSaleCommand';
import { RecordSaleCommand } from './application/commands/RecordSaleCommand';
import { RecordTaxPaymentCommand } from './application/commands/RecordTaxPaymentCommand';
import { EVENT_METRICS } from './application/ports/EventMetrics';
import { GetTaxPositionQuery } from './application/queries/GetTaxPositionQuery';
import { APP_CONFIG, IAppConfig } from './config/config';
import { SaleController } from './http/SaleController';
import { TaxPositionController } from './http/TaxPositionController';
import { TransactionsController } from './http/TransactionsController';
import { VALIDATION_OPTIONS } from './http/validation/validationOptions';
import { HealthController } from './infrastructure/observability/HealthController';
import { createLoggerOptions } from './infrastructure/observability/loggerOptions';
import { MetricsController } from './infrastructure/observability/MetricsController';
import { MetricsService } from './infrastructure/observability/MetricsService';
import { ReadinessState } from './infrastructure/observability/ReadinessState';
import { PostgresModule } from './infrastructure/postgres/PostgresModule';

@Module({})
export class AppModule {}

@Module({})
class ConfigModule {}

export function createAppModule(config: IAppConfig): DynamicModule {
  return {
    module: AppModule,
    imports: [
      {
        module: ConfigModule,
        global: true,
        providers: [{ provide: APP_CONFIG, useValue: config }],
        exports: [APP_CONFIG],
      },
      LoggerModule.forRoot(createLoggerOptions(config)),
      PostgresModule,
    ],
    controllers: [TransactionsController, SaleController, TaxPositionController, HealthController, MetricsController],
    providers: [
      RecordSaleCommand,
      RecordTaxPaymentCommand,
      AmendSaleCommand,
      GetTaxPositionQuery,
      MetricsService,
      { provide: EVENT_METRICS, useExisting: MetricsService },
      ReadinessState,
      { provide: APP_PIPE, useValue: new ValidationPipe(VALIDATION_OPTIONS) },
    ],
  };
}
