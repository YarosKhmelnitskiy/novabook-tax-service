# Novabook Tax Service

A service that ingests sales and tax payment events, accepts amendments to invoice items, and answers what the tax position was at any point in time.

The position at moment D is the tax on every sale item dated at or before D, minus every tax payment dated at or before D.
Events can arrive in any order and carry past or future dates; the answer depends only on the dates in the events, never on when they arrived.

Built with TypeScript, NestJS 11 and Postgres.
Every decision on an open question is listed under [Assumptions & decisions](#assumptions--decisions), and the acceptance scenarios that pin them are under [Tests](#tests).

## Quick start

Requirements: Docker with Compose.

```bash
docker compose up --build
```

The API listens on `http://localhost:3000`, Postgres on `localhost:5434`.
Migrations run automatically when the service starts.

### Local development

Requirements: Node 24.13+, pnpm, Docker.

```bash
docker compose up -d db
pnpm install
DATABASE_URL=postgres://novabook:novabook@localhost:5434/novabook pnpm start:dev
```

Configuration comes from environment variables; `example.env` lists them with values that match docker-compose.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATABASE_URL` | none, required | Postgres connection string |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `SHUTDOWN_DRAIN_MS` | `5000` | How long readiness reports 503 before the server closes on SIGTERM |

Invalid configuration stops start-up with a message that lists every problem.

## API

All amounts are integer pence.
All dates are ISO 8601 with a time zone, for example `2024-02-22T17:29:39Z` or `2024-02-22T19:29:39+02:00`.

### Ingest a sale or a tax payment

```bash
curl -i -X POST localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{
    "eventType": "SALES",
    "date": "2024-02-22T17:29:39Z",
    "invoiceId": "3419027d-960f-4e8f-b8b7-f7b2b4791824",
    "items": [{ "itemId": "02db47b6-fe68-4005-a827-24c6e962f3df", "cost": 1099, "taxRate": 0.2 }]
  }'

curl -i -X POST localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{ "eventType": "TAX_PAYMENT", "date": "2024-02-22T17:29:39Z", "amount": 74901 }'
```

`202 Accepted` with no body.
`400` for an invalid body, `409` if a sale with this `invoiceId` is already recorded with different content.

### Amend an item of a sale

```bash
curl -i -X PATCH localhost:3000/sale \
  -H 'Content-Type: application/json' \
  -d '{
    "date": "2024-02-22T17:29:39Z",
    "invoiceId": "3419027d-960f-4e8f-b8b7-f7b2b4791824",
    "itemId": "02db47b6-fe68-4005-a827-24c6e962f3df",
    "cost": 798,
    "taxRate": 0.15
  }'
```

`202 Accepted` with no body, even if the sale or the item has not been received yet.

### Query the tax position

```bash
curl -s 'localhost:3000/tax-position?date=2024-02-22T17:29:39Z'
```

```json
{ "date": "2024-02-22T17:29:39Z", "taxPosition": 120 }
```

A `+` in the query string must be encoded as `%2B` (`2024-02-22T19:29:39%2B02:00`); otherwise it arrives as a space and the error message says so.

### Errors

Errors use the standard NestJS body.
For a `400`, `message` lists every validation problem:

```json
{
  "statusCode": 400,
  "message": ["items.0.cost must be a whole number of pence, at least 0 and at most 9007199254740991"],
  "error": "Bad Request"
}
```

A conflicting sale answers `409` with a message that names the invoice; unexpected failures answer a generic `500`.

## Assumptions & decisions

The task leaves several questions open.
Each answer below is pinned by a test.

**An amendment changes an item from the amendment's date onwards.**
The spec amends an item "at a specific point in time", so a query before that date still sees the original values.
An amendment never rewrites the past.

**An amendment only changes an item that a sale created; it never creates one.**
An amendment for a sale that has not arrived is stored and starts to apply when the sale arrives.
An amendment for an item the sale does not contain is stored and ignored.
If amendments created sales, a mistyped `invoiceId` would add phantom tax that the API offers no way to remove.
Such an orphaned amendment is counted once in a metric and logged as a warning as soon as both it and its sale are recorded, whichever arrives second.

**An amendment dated before its sale applies from the sale date.**
The sale decides when an item exists; the amendment decides its cost and rate.
Equal timestamps (as in the spec's own examples) and small clock differences between the system that records sales and the one that sends amendments therefore never drop an amendment silently.

**Of several amendments of one item, the latest by date wins; on equal dates the later arrival wins.**
This is one of the two places where arrival order matters, and it matches "the last instruction wins".

**An identical repeat of an amendment is a no-op and keeps its original place in the order.**
Otherwise a client retry could override a different amendment that arrived between the original request and the retry.
To restore earlier values, send an amendment with a new date.

**A recorded sale never changes.**
An identical repeat (same moment, same items, any item order) is accepted as a duplicate.
A sale with the same `invoiceId` and different content, including a different date, is rejected with 409, because a recorded invoice is a document; its items change only through amendments.
This is the second place where arrival order matters: the first version to arrive is kept, and the client is told about the conflict.

**Tax payments are not deduplicated.**
A payment has no identifier, and two payments of the same amount at the same moment are legitimate.
Deduplicating by date and amount would silently drop real payments.

**The boundary is inclusive.**
An event dated exactly at the queried moment counts.

**The position can be negative.**
That is an overpayment, not an error.

**Future dates are allowed** for events and for queries.

**Validation is strict.**
A date without a time zone is rejected, because its meaning would depend on the server time zone.
Numbers sent as strings, fractional pence and unknown fields are rejected; for example, an unexpected `"currency": "EUR"` must not be silently treated as pence.
Item ids must be unique within one sale.

**Writes are synchronous.**
After a `202`, the next query already sees the event.

## Tax calculation and rounding

The tax of one item is `round_half_up(cost × taxRate)`, in whole pence.
Each item is rounded on its own, so every item of an invoice has a definite tax and an amendment replaces one whole number with another.
Per-item rounding differs from the exact value by at most half a penny per item.

Money never touches floating point.
`taxRate` is converted to an integer number of billionths (`0.175` becomes `175000000`); the tax is then `(cost × billionths + 500000000) / 1000000000` in `BigInt`, and the sum is `BigInt` too.
For comparison, `Math.round(180 * 0.175)` in JavaScript gives 31 because `180 * 0.175` is `31.499999999999996`; the service returns the correct 32.
A rate with more than 9 decimal places is rejected rather than rounded silently.

## Observability

**Logs.**
JSON lines on stdout via pino, with an ISO timestamp.
Every request has a `requestId`: the incoming `x-request-id` header if it is present and at most 128 characters, otherwise a generated UUID.
It is echoed in the `x-request-id` response header and appears in every log line of that request.
One access line per request carries `method`, `route`, `statusCode` and `durationMs`; health and metrics requests are left out.
Domain events are logged at info, conflicting sales and orphaned amendments at warn, unexpected failures at error with the stack.
Rejected requests show up in the access line with their status code.

**Metrics.**
Prometheus format at `GET /metrics`:

| Metric | Type | Labels |
|---|---|---|
| `novabook_tax_http_request_duration_seconds` | histogram | `method`, `route` (template), `status_code` |
| `novabook_tax_events_total` | counter | `event_type` (`sales`, `tax_payment`, `amendment`), `result` (`recorded`, `duplicate`, `conflict`) |
| `novabook_tax_orphaned_amendments_total` | counter | none |

Default Node.js process metrics are included.
Every event counter combination starts at zero, so dashboards and alerts see the series before the first event.
`/metrics` has no authentication because the service is single-user.

**Health.**
`GET /health/liveness` answers 200 while the process runs.
`GET /health/readiness` answers 200 when Postgres responds to `SELECT 1`, and 503 otherwise or during shutdown.

**Shutdown.**
On SIGTERM or SIGINT readiness switches to 503, the service keeps serving for `SHUTDOWN_DRAIN_MS` so a load balancer can stop routing to it, then it closes the HTTP server and the database pool.
A timer forces an exit if this hangs.

## Tests

Tests use the built-in Node test runner (`node:test` and `node:assert`), so the test stack adds no dependencies beyond supertest.
Integration and e2e tests need the Postgres container; each test file creates its own database `tax_test_<uuid>` and drops it at the end.

```bash
docker compose up -d db
pnpm test        # unit tests, no database
pnpm test:int    # repository against Postgres
pnpm test:e2e    # the whole HTTP API against Postgres
pnpm lint
```

To use another Postgres server, set `TEST_DATABASE_ADMIN_URL` to a connection string for a user that can create databases.

The e2e suite runs these acceptance scenarios through the HTTP API:

| | Scenario |
|---|---|
| A | An amendment applies from its own date; earlier queries still see the original item |
| B | The events of A sent in reverse order give the same answers |
| C | An amendment that arrives before its sale and is dated before it applies from the sale date |
| D | An amendment of an item missing from the sale is ignored |
| E | An amendment without a sale is ignored |
| F | Of two amendments at the same moment, the later arrival wins |
| G | Tax is rounded exactly, half up per item (`180 × 0.175` gives 32) |
| H | An identical sale is accepted once; a different one with the same `invoiceId` gets 409 |
| I | Two identical tax payments both count |
| J | An event dated exactly at the queried moment counts |
| K | A retried amendment does not override one that arrived in between |

## Project structure

```text
src/
  bootstrap.ts        entry point: configuration, start-up
  app.ts              Nest application, middleware, graceful shutdown
  AppModule.ts        dependency wiring
  config/             typed configuration from the environment
  domain/             pure TypeScript: TaxRate, calculateTaxPosition, isSameSale
  application/        commands, the query and the ports they depend on
  infrastructure/
    postgres/         Kysely, migrations, the repository
    observability/    logging, metrics, health
  http/               controllers, DTOs, validation
test/                 e2e tests
```

Dependencies point inwards: `http` uses `application`, `application` uses `domain`, and `infrastructure` implements the ports defined in `application`.
The domain has no framework or database code, so the tax arithmetic is covered by plain unit tests.

The database is insert-only.
The position is calculated on read from the facts dated up to the requested moment, which is what makes arrival order irrelevant.
One query returns, for every item of a sale dated up to D, the values in effect at D: those of its latest amendment dated up to D (the later arrival on equal dates), or the original ones.
A second query sums the payments dated up to D; both run in one `REPEATABLE READ` transaction, so they see the same snapshot.
The domain then rounds and adds up the tax of these items, so the rounding rule lives in one place.
The amendment rules are pinned by the repository's integration tests and by the e2e scenarios.

## Limitations and next steps

- Every query reads one row per sale item dated up to D, so its cost grows with the number of items.
  At larger volumes the rounding could move into SQL so that a query returns a single number, or daily snapshots could be stored.
- Tax payments cannot be deduplicated; an optional `Idempotency-Key` header would let clients retry safely.
- Sales cannot be cancelled and items cannot be removed, other than amending an item to a cost of 0.
- One currency, no authentication, no tenants, no financial years, as the task specifies.
- No tracing; adding OpenTelemetry would extend the existing request id into distributed traces.
