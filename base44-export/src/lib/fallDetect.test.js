import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFallPattern, magnitude } from './fallDetect.js';

test('magnitude 3 axes', () => {
  assert.equal(Math.round(magnitude(3, 4, 0)), 5);
});

test('chute = pic puis immobilité', () => {
  const rest = Array(8).fill(9.8);
  const hit = [...rest, 28, 3.2, 3.1, 2.9, 3.0];
  assert.equal(isFallPattern(hit), true);
  assert.equal(isFallPattern(rest), false);
});
