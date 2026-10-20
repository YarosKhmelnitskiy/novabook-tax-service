import { PinoLogger } from 'nestjs-pino';

export type TLogger = Pick<PinoLogger, 'info' | 'warn'>;
