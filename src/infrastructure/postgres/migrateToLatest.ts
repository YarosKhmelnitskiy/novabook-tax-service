import { Kysely, Migration, MigrationResultSet, Migrator } from 'kysely';
import { IDatabase } from './database';
import * as initial from './migrations/0001_initial';

const migrations: Record<string, Migration> = {
  '0001_initial': initial,
};

export async function migrateToLatest(db: Kysely<IDatabase>): Promise<string[]> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
  const { error, results }: MigrationResultSet = await migrator.migrateToLatest();
  if (error !== undefined) {
    throw error;
  }
  return (results ?? []).map((result) => result.migrationName);
}
