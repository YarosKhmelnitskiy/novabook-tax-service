import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  amendmentPayload,
  day,
  errorMessage,
  ITestApp,
  paymentPayload,
  salePayload,
  startTestApp,
} from './support/testApp';

describe('E2E | Tax service', () => {
  let testApp: ITestApp;

  const ingest = async (payload: object): Promise<void> => {
    await testApp.http().post('/transactions').send(payload).expect(202);
  };

  const amend = async (payload: object): Promise<void> => {
    await testApp.http().patch('/sale').send(payload).expect(202);
  };

  const positionAt = async (date: string): Promise<number> => {
    const response = await testApp
      .http()
      .get('/tax-position')
      .query({ date: day(date) })
      .expect(200);
    assert.deepEqual(response.body, { date: day(date), taxPosition: response.body.taxPosition });
    return response.body.taxPosition;
  };

  const scenarioA = {
    sale: salePayload('inv-1', '2024-02-01', [{ itemId: 'A', cost: 1000, taxRate: 0.2 }]),
    payment: paymentPayload('2024-02-05', 150),
    amendment: amendmentPayload('inv-1', 'A', '2024-02-10', 500, 0.2),
  };

  before(async () => {
    testApp = await startTestApp();
  });

  beforeEach(async () => {
    await testApp.reset();
  });

  after(async () => {
    await testApp.close();
  });

  describe('acceptance scenarios', () => {
    it('A: an amendment applies from its own date', async () => {
      await ingest(scenarioA.sale);
      await ingest(scenarioA.payment);
      await amend(scenarioA.amendment);

      assert.strictEqual(await positionAt('2024-01-31'), 0);
      assert.strictEqual(await positionAt('2024-02-03'), 200);
      assert.strictEqual(await positionAt('2024-02-07'), 50);
      assert.strictEqual(await positionAt('2024-02-12'), -50);
    });

    it('B: arrival order does not change the answers', async () => {
      await amend(scenarioA.amendment);
      await ingest(scenarioA.payment);
      await ingest(scenarioA.sale);

      assert.strictEqual(await positionAt('2024-01-31'), 0);
      assert.strictEqual(await positionAt('2024-02-03'), 200);
      assert.strictEqual(await positionAt('2024-02-07'), 50);
      assert.strictEqual(await positionAt('2024-02-12'), -50);
    });

    it('C: an amendment that arrives first and is dated before the sale applies from the sale date', async () => {
      await amend(amendmentPayload('inv-3', 'Z', '2024-04-01', 3000, 0.1));
      await ingest(salePayload('inv-3', '2024-04-05', [{ itemId: 'Z', cost: 1000, taxRate: 0.2 }]));

      assert.strictEqual(await positionAt('2024-04-03'), 0);
      assert.strictEqual(await positionAt('2024-04-06'), 300);
    });

    it('D: an amendment of an item missing from the sale is ignored', async () => {
      await ingest(salePayload('inv-2', '2024-03-01', [{ itemId: 'X', cost: 1000, taxRate: 0.2 }]));
      await amend(amendmentPayload('inv-2', 'Y', '2024-03-02', 5000, 0.2));

      assert.strictEqual(await positionAt('2024-03-03'), 200);
    });

    it('E: an amendment without a sale is ignored', async () => {
      await amend(amendmentPayload('inv-404', 'Q', '2024-05-01', 1000, 0.2));

      assert.strictEqual(await positionAt('2024-05-02'), 0);
    });

    it('F: of two amendments at the same moment the later arrival wins', async () => {
      await ingest(scenarioA.sale);
      await ingest(scenarioA.payment);
      await amend(scenarioA.amendment);
      await amend(amendmentPayload('inv-1', 'A', '2024-02-10', 700, 0.2));

      assert.strictEqual(await positionAt('2024-02-12'), -10);
    });

    it('G: tax is rounded exactly, half up per item', async () => {
      await ingest(
        salePayload('inv-g', '2024-06-01', [
          { itemId: 'A', cost: 180, taxRate: 0.175 },
          { itemId: 'B', cost: 1000, taxRate: 0.08875 },
        ]),
      );

      assert.strictEqual(await positionAt('2024-06-01'), 32 + 89);
    });

    it('H: an identical sale is accepted once and a different one is rejected', async () => {
      const original = salePayload('inv-h', '2024-07-01', [{ itemId: 'A', cost: 1000, taxRate: 0.2 }]);
      await ingest(original);
      await ingest(original);

      const response = await testApp
        .http()
        .post('/transactions')
        .send(salePayload('inv-h', '2024-07-01', [{ itemId: 'A', cost: 999, taxRate: 0.2 }]))
        .expect(409);

      assert.match(errorMessage(response.body), /inv-h is already recorded with different content/);
      assert.strictEqual(await positionAt('2024-07-02'), 200);
    });

    it('I: two identical tax payments both count', async () => {
      await ingest(paymentPayload('2024-08-01', 100));
      await ingest(paymentPayload('2024-08-01', 100));

      assert.strictEqual(await positionAt('2024-08-01'), -200);
    });

    it('J: an event dated exactly at the queried moment counts', async () => {
      await ingest(salePayload('inv-j', '2024-09-01', [{ itemId: 'A', cost: 1000, taxRate: 0.2 }]));

      assert.strictEqual(await positionAt('2024-09-01'), 200);
    });

    it('K: a retried amendment does not override one that arrived in between', async () => {
      await ingest(scenarioA.sale);
      await ingest(scenarioA.payment);
      await amend(scenarioA.amendment);
      await amend(amendmentPayload('inv-1', 'A', '2024-02-10', 700, 0.2));
      await amend(scenarioA.amendment);

      assert.strictEqual(await positionAt('2024-02-12'), -10);
    });
  });

  describe('dates', () => {
    it('compares moments across time zones', async () => {
      await ingest({ ...paymentPayload('2024-02-01', 100), date: '2024-02-01T02:00:00+02:00' });

      assert.strictEqual(await positionAt('2024-02-01'), -100);
    });

    it('echoes the queried date unchanged', async () => {
      const response = await testApp
        .http()
        .get('/tax-position')
        .query({ date: '2024-02-22T19:29:39+02:00' })
        .expect(200);

      assert.deepEqual(response.body, { date: '2024-02-22T19:29:39+02:00', taxPosition: 0 });
    });
  });

  describe('validation', () => {
    const invalidTransactions: Array<{ name: string; payload: unknown }> = [
      { name: 'an unknown eventType', payload: { eventType: 'REFUND', date: day('2024-01-01'), amount: 1 } },
      { name: 'a body that is not an object', payload: [1, 2] },
      {
        name: 'a cost sent as a string',
        payload: salePayload('inv', '2024-01-01', [{ itemId: 'A', cost: '1099' as unknown as number, taxRate: 0.2 }]),
      },
      {
        name: 'a fractional cost',
        payload: salePayload('inv', '2024-01-01', [{ itemId: 'A', cost: 10.5, taxRate: 0.2 }]),
      },
      { name: 'a negative cost', payload: salePayload('inv', '2024-01-01', [{ itemId: 'A', cost: -1, taxRate: 0.2 }]) },
      {
        name: 'a tax rate above 1',
        payload: salePayload('inv', '2024-01-01', [{ itemId: 'A', cost: 1, taxRate: 20 }]),
      },
      {
        name: 'a tax rate with 10 decimal places',
        payload: salePayload('inv', '2024-01-01', [{ itemId: 'A', cost: 1, taxRate: 0.1234567891 }]),
      },
      { name: 'empty items', payload: salePayload('inv', '2024-01-01', []) },
      {
        name: 'a repeated itemId',
        payload: salePayload('inv', '2024-01-01', [
          { itemId: 'A', cost: 1, taxRate: 0.2 },
          { itemId: 'A', cost: 2, taxRate: 0.2 },
        ]),
      },
      {
        name: 'a date without a time zone',
        payload: { ...paymentPayload('2024-01-01', 1), date: '2024-01-01T00:00:00' },
      },
      { name: 'a zero tax payment', payload: paymentPayload('2024-01-01', 0) },
      { name: 'an unknown field', payload: { ...paymentPayload('2024-01-01', 1), currency: 'EUR' } },
    ];

    for (const { name, payload } of invalidTransactions) {
      it(`rejects a transaction with ${name}`, async () => {
        const response = await testApp
          .http()
          .post('/transactions')
          .send(payload as object)
          .expect(400);

        assert.notStrictEqual(errorMessage(response.body), '');
      });
    }

    it('rejects malformed JSON', async () => {
      await testApp
        .http()
        .post('/transactions')
        .set('Content-Type', 'application/json')
        .send('{"eventType":')
        .expect(400);
    });

    it('rejects an amendment without a tax rate', async () => {
      const { taxRate: _omitted, ...withoutRate } = amendmentPayload('inv', 'A', '2024-01-01', 1, 0.2);
      const response = await testApp.http().patch('/sale').send(withoutRate).expect(400);

      assert.match(errorMessage(response.body), /taxRate/);
    });

    it('rejects a tax position query without a date', async () => {
      const response = await testApp.http().get('/tax-position').expect(400);

      assert.match(errorMessage(response.body), /date query parameter is required/);
    });

    it('explains a "+" that arrived as a space', async () => {
      const response = await testApp.http().get('/tax-position?date=2024-02-22T19:29:39+02:00').expect(400);

      assert.match(errorMessage(response.body), /%2B/);
    });
  });

  describe('observability', () => {
    it('reports liveness and readiness', async () => {
      await testApp.http().get('/health/liveness').expect(200, { status: 'ok' });
      await testApp.http().get('/health/readiness').expect(200, { status: 'ok' });
    });

    const readMetric = async (series: string): Promise<number> => {
      const response = await testApp.http().get('/metrics').expect(200);
      const line = response.text.split('\n').find((candidate) => candidate.startsWith(`${series} `));
      assert.notStrictEqual(line, undefined, `metric ${series} is exposed`);
      return Number(line?.slice(series.length + 1));
    };

    it('counts recorded and duplicate sales', async () => {
      const recorded = 'novabook_tax_events_total{event_type="sales",result="recorded"}';
      const duplicate = 'novabook_tax_events_total{event_type="sales",result="duplicate"}';
      const recordedBefore = await readMetric(recorded);
      const duplicateBefore = await readMetric(duplicate);

      await ingest(scenarioA.sale);
      await ingest(scenarioA.sale);

      assert.strictEqual((await readMetric(recorded)) - recordedBefore, 1);
      assert.strictEqual((await readMetric(duplicate)) - duplicateBefore, 1);
    });

    it('initialises every event counter at zero', async () => {
      await readMetric('novabook_tax_events_total{event_type="amendment",result="duplicate"}');
      await readMetric('novabook_tax_events_total{event_type="sales",result="conflict"}');
    });

    it('measures requests by route template', async () => {
      await ingest(paymentPayload('2024-02-01', 1));

      const count = await readMetric(
        'novabook_tax_http_request_duration_seconds_count{method="POST",route="/transactions",status_code="202"}',
      );

      assert.ok(count > 0);
    });

    it('counts an amendment orphaned when its sale arrives later', async () => {
      const series = 'novabook_tax_orphaned_amendments_total';
      const before = await readMetric(series);

      await amend(amendmentPayload('inv-o', 'Z', '2024-02-10', 1, 0.2));
      await ingest(salePayload('inv-o', '2024-02-01', [{ itemId: 'A', cost: 1, taxRate: 0.2 }]));

      assert.strictEqual((await readMetric(series)) - before, 1);
    });

    it('counts an amendment orphaned when it arrives after its sale', async () => {
      const series = 'novabook_tax_orphaned_amendments_total';
      const before = await readMetric(series);

      await ingest(salePayload('inv-o', '2024-02-01', [{ itemId: 'A', cost: 1, taxRate: 0.2 }]));
      await amend(amendmentPayload('inv-o', 'Z', '2024-02-10', 1, 0.2));

      assert.strictEqual((await readMetric(series)) - before, 1);
    });

    it('echoes a valid x-request-id and generates one otherwise', async () => {
      const echoed = await testApp.http().get('/health/liveness').set('x-request-id', 'trace-42').expect(200);
      const generated = await testApp.http().get('/health/liveness').expect(200);

      assert.strictEqual(echoed.headers['x-request-id'], 'trace-42');
      assert.match(generated.headers['x-request-id'], /^[0-9a-f-]{36}$/);
    });
  });
});
