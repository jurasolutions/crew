import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCents, splitEvenly, toCents } from '../src/split.js';

test('toCents parses amounts', () => {
  assert.equal(toCents('12.5'), 1250);
  assert.equal(toCents('0.07'), 7);
  assert.throws(() => toCents('1.234'));
});

test('formatCents formats', () => {
  assert.equal(formatCents(1250), '12.50');
  assert.equal(formatCents(7), '0.07');
});

test('even split adds up exactly', () => {
  assert.deepEqual(splitEvenly(1000, 3), [334, 333, 333]);
  assert.equal(splitEvenly(1000, 3).reduce((a, b) => a + b), 1000);
});

test('rejects bad input', () => {
  assert.throws(() => splitEvenly(10.5, 2));
  assert.throws(() => splitEvenly(100, 0));
});
