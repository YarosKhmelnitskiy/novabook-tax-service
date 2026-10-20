process.env.TZ = 'UTC';

import 'reflect-metadata';
import { startServer } from './app';
import { loadConfig } from './config/config';

startServer(loadConfig(process.env)).catch((error: unknown) => {
  process.stderr.write(`Failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
