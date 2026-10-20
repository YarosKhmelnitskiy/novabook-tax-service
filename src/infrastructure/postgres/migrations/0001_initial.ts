import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sales')
    .addColumn('invoice_id', 'varchar(255)', (column) => column.primaryKey())
    .addColumn('date', 'timestamptz', (column) => column.notNull())
    .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('sale_items')
    .addColumn('invoice_id', 'varchar(255)', (column) => column.notNull().references('sales.invoice_id'))
    .addColumn('item_id', 'varchar(255)', (column) => column.notNull())
    .addColumn('cost', 'bigint', (column) => column.notNull().check(sql`cost >= 0`))
    .addColumn('tax_rate_e9', 'bigint', (column) => column.notNull().check(sql`tax_rate_e9 BETWEEN 0 AND 1000000000`))
    .addPrimaryKeyConstraint('sale_items_pkey', ['invoice_id', 'item_id'])
    .execute();

  await db.schema
    .createTable('sale_amendments')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('invoice_id', 'varchar(255)', (column) => column.notNull())
    .addColumn('item_id', 'varchar(255)', (column) => column.notNull())
    .addColumn('date', 'timestamptz', (column) => column.notNull())
    .addColumn('cost', 'bigint', (column) => column.notNull().check(sql`cost >= 0`))
    .addColumn('tax_rate_e9', 'bigint', (column) => column.notNull().check(sql`tax_rate_e9 BETWEEN 0 AND 1000000000`))
    .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('tax_payments')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('date', 'timestamptz', (column) => column.notNull())
    .addColumn('amount', 'bigint', (column) => column.notNull().check(sql`amount > 0`))
    .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('sales_date_idx').on('sales').column('date').execute();
  await db.schema
    .createIndex('sale_amendments_identity_idx')
    .unique()
    .on('sale_amendments')
    .columns(['invoice_id', 'item_id', 'date', 'cost', 'tax_rate_e9'])
    .execute();
  await db.schema.createIndex('tax_payments_date_idx').on('tax_payments').column('date').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('tax_payments').execute();
  await db.schema.dropTable('sale_amendments').execute();
  await db.schema.dropTable('sale_items').execute();
  await db.schema.dropTable('sales').execute();
}
