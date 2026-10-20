import { setTimeout as delay } from 'node:timers/promises';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, PinoLogger } from 'nestjs-pino';
import { createAppModule } from './AppModule';
import { IAppConfig } from './config/config';
import { createHttpObservabilityMiddleware } from './infrastructure/observability/httpObservabilityMiddleware';
import { MetricsService } from './infrastructure/observability/MetricsService';
import { ReadinessState } from './infrastructure/observability/ReadinessState';

const FORCED_EXIT_GRACE_MS = 10_000;

export async function createApp(config: IAppConfig): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(createAppModule(config), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.use(createHttpObservabilityMiddleware(app.get(MetricsService), (await app.resolve(PinoLogger)).logger));
  app.useBodyParser('json', { limit: '1mb' });
  return app;
}

export async function startServer(config: IAppConfig): Promise<void> {
  const app = await createApp(config);
  await app.listen(config.port);
  const logger = app.get(Logger);
  logger.log(`Listening on port ${config.port}`, 'Bootstrap');

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.log(`Received ${signal}, draining for ${config.shutdownDrainMs} ms`, 'Bootstrap');
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit', 'Bootstrap');
      process.exit(1);
    }, config.shutdownDrainMs + FORCED_EXIT_GRACE_MS).unref();

    app.get(ReadinessState).markShuttingDown();
    await delay(config.shutdownDrainMs);
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}
