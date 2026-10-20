import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig } from './config';

const env = (entries: Array<[string, string]>): NodeJS.ProcessEnv => Object.fromEntries(entries);

describe('Config | loadConfig', () => {
  const databaseUrl = 'postgres://novabook:novabook@localhost:5434/novabook';

  it('applies defaults', () => {
    assert.deepEqual(loadConfig(env([['DATABASE_URL', databaseUrl]])), {
      port: 3000,
      databaseUrl,
      logLevel: 'info',
      shutdownDrainMs: 5000,
    });
  });

  it('lists every problem at once', () => {
    assert.throws(
      () =>
        loadConfig(
          env([
            ['PORT', 'abc'],
            ['LOG_LEVEL', 'loud'],
          ]),
        ),
      (error: unknown) =>
        error instanceof ConfigError &&
        /PORT must be a non-negative integer[\s\S]*DATABASE_URL[\s\S]*LOG_LEVEL/.test(error.message),
    );
  });
});
