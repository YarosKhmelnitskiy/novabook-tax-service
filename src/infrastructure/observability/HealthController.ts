import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { Response } from 'express';
import { Kysely, sql } from 'kysely';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DATABASE, IDatabase } from '../postgres/database';
import { ReadinessState } from './ReadinessState';

export interface IHealthStatus {
  status: 'ok' | 'down';
}

@Controller('health')
export class HealthController {
  public constructor(
    @Inject(DATABASE) private readonly db: Kysely<IDatabase>,
    private readonly readinessState: ReadinessState,
    @InjectPinoLogger(HealthController.name) private readonly logger: PinoLogger,
  ) {}

  @Get('liveness')
  public liveness(): IHealthStatus {
    return { status: 'ok' };
  }

  @Get('readiness')
  public async readiness(@Res({ passthrough: true }) res: Response): Promise<IHealthStatus> {
    if (this.readinessState.isShuttingDown || !(await this.isDatabaseReachable())) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'down' };
    }
    return { status: 'ok' };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await sql`SELECT 1`.execute(this.db);
      return true;
    } catch (error) {
      this.logger.warn({ err: error }, 'Readiness check cannot reach the database');
      return false;
    }
  }
}
