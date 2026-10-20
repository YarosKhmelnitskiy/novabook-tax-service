export const APP_CONFIG = Symbol('APP_CONFIG');

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type TLogLevel = (typeof LOG_LEVELS)[number];

export interface IAppConfig {
  port: number;
  databaseUrl: string;
  logLevel: TLogLevel;
  shutdownDrainMs: number;
}

export class ConfigError extends Error {
  public constructor(problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): IAppConfig {
  const problems: string[] = [];

  const port = readInteger(env, 'PORT', 3000, problems);
  const shutdownDrainMs = readInteger(env, 'SHUTDOWN_DRAIN_MS', 5000, problems);
  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    problems.push('DATABASE_URL must be a postgres:// connection string');
  }
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!isLogLevel(logLevel)) {
    problems.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}`);
  }

  if (problems.length > 0 || !isLogLevel(logLevel)) {
    throw new ConfigError(problems);
  }
  return { port, databaseUrl, logLevel, shutdownDrainMs };
}

function readInteger(env: NodeJS.ProcessEnv, name: string, fallback: number, problems: string[]): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    problems.push(`${name} must be a non-negative integer`);
  }
  return value;
}

function isLogLevel(value: string): value is TLogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}
