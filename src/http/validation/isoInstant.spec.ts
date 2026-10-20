import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { looksLikeUnencodedPlus, parseIsoInstant } from './isoInstant';

describe('Http | parseIsoInstant', () => {
  const valid: Array<{ input: string; expected: string }> = [
    { input: '2024-02-22T17:29:39Z', expected: '2024-02-22T17:29:39.000Z' },
    { input: '2024-02-22T19:29:39+02:00', expected: '2024-02-22T17:29:39.000Z' },
    { input: '2024-02-22T12:29:39-05:00', expected: '2024-02-22T17:29:39.000Z' },
    { input: '2024-02-22T17:29:39.5Z', expected: '2024-02-22T17:29:39.500Z' },
    { input: '2024-02-22T17:29:39.123456789Z', expected: '2024-02-22T17:29:39.123Z' },
    { input: '2024-02-29T00:00:00Z', expected: '2024-02-29T00:00:00.000Z' },
    { input: '0050-01-01T00:00:00Z', expected: '0050-01-01T00:00:00.000Z' },
  ];

  for (const { input, expected } of valid) {
    it(`parses ${input}`, () => {
      assert.strictEqual(parseIsoInstant(input)?.toISOString(), expected);
    });
  }

  const invalid: unknown[] = [
    '2024-02-22',
    '2024-02-22T17:29:39',
    '2024-02-22 17:29:39Z',
    '2024-02-30T00:00:00Z',
    '2023-02-29T00:00:00Z',
    '2024-13-01T00:00:00Z',
    '2024-02-22T24:00:00Z',
    '2024-02-22T17:29:60Z',
    '2024-02-22T17:29:39+24:00',
    '2024-02-22T17:29:39 02:00',
    '',
    1708622979000,
    null,
  ];

  for (const input of invalid) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      assert.strictEqual(parseIsoInstant(input), null);
    });
  }

  it('recognises a "+" that arrived as a space', () => {
    assert.strictEqual(looksLikeUnencodedPlus('2024-02-22T19:29:39 02:00'), true);
    assert.strictEqual(looksLikeUnencodedPlus('2024-02-22T19:29:39+02:00'), false);
  });
});
