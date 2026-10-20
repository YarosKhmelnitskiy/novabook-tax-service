import { CamelCasePlugin, Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool, types } from 'pg';

export const DATABASE = Symbol('DATABASE');

export interface ISalesTable {
  invoiceId: string;
  date: Date;
  receivedAt: Generated<Date>;
}

export interface ISaleItemsTable {
  invoiceId: string;
  itemId: string;
  cost: bigint;
  taxRateE9: bigint;
}

export interface ISaleAmendmentsTable {
  id: Generated<bigint>;
  invoiceId: string;
  itemId: string;
  date: Date;
  cost: bigint;
  taxRateE9: bigint;
  receivedAt: Generated<Date>;
}

export interface ITaxPaymentsTable {
  id: Generated<bigint>;
  date: Date;
  amount: bigint;
  receivedAt: Generated<Date>;
}

export interface IDatabase {
  sales: ISalesTable;
  saleItems: ISaleItemsTable;
  saleAmendments: ISaleAmendmentsTable;
  taxPayments: ITaxPaymentsTable;
}

const parseBigint = (value: string): bigint => BigInt(value);

export function createDatabase(connectionString: string): Kysely<IDatabase> {
  const pool = new Pool({
    connectionString,
    types: {
      getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
        oid === types.builtins.INT8 ? parseBigint : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
    },
  });
  return new Kysely<IDatabase>({ dialect: new PostgresDialect({ pool }), plugins: [new CamelCasePlugin()] });
}
