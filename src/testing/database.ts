import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import { Client } from 'pg';
import { IDatabase } from '../infrastructure/postgres/database';

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://novabook:novabook@localhost:5434/postgres';

export interface ITestDatabase {
  url: string;
  drop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<ITestDatabase> {
  const name = `tax_test_${randomUUID().replaceAll('-', '')}`;
  await runAdminQuery(`CREATE DATABASE ${name}`);
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return { url: url.toString(), drop: () => runAdminQuery(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`) };
}

export async function truncateAll(db: Kysely<IDatabase>): Promise<void> {
  await sql`TRUNCATE sale_items, sales, sale_amendments, tax_payments RESTART IDENTITY`.execute(db);
}

async function runAdminQuery(query: string): Promise<void> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}
