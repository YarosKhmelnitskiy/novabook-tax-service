import { NestExpressApplication } from '@nestjs/platform-express';
import { Kysely } from 'kysely';
import request from 'supertest';
import { createApp } from '../../src/app';
import { DATABASE, IDatabase } from '../../src/infrastructure/postgres/database';
import { createTestDatabase, truncateAll } from '../../src/testing/database';

export interface ITestApp {
  http: () => ReturnType<typeof request>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function startTestApp(): Promise<ITestApp> {
  const testDatabase = await createTestDatabase();
  const app: NestExpressApplication = await createApp({
    port: 0,
    databaseUrl: testDatabase.url,
    logLevel: 'silent',
    shutdownDrainMs: 0,
  });
  await app.init();
  const db = app.get<Kysely<IDatabase>>(DATABASE);
  return {
    http: () => request(app.getHttpServer()),
    reset: () => truncateAll(db),
    close: async () => {
      await app.close();
      await testDatabase.drop();
    },
  };
}

export const day = (date: string): string => `${date}T00:00:00Z`;

export const errorMessage = (body: { message?: unknown }): string =>
  Array.isArray(body.message) ? body.message.join('; ') : String(body.message);

export interface ISaleItemPayload {
  itemId: string;
  cost: number;
  taxRate: number;
}

export const salePayload = (invoiceId: string, date: string, items: ISaleItemPayload[]): object => ({
  eventType: 'SALES',
  date: day(date),
  invoiceId,
  items,
});

export const paymentPayload = (date: string, amount: number): object => ({
  eventType: 'TAX_PAYMENT',
  date: day(date),
  amount,
});

export const amendmentPayload = (invoiceId: string, itemId: string, date: string, cost: number, taxRate: number) => ({
  date: day(date),
  invoiceId,
  itemId,
  cost,
  taxRate,
});
