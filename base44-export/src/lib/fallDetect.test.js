import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiltFromVertical, isLossOfVerticality, isFlatFromBeta, magnitude } from './fallDetect.js';

test('magnitude 3 axes', () => {
  assert.equal(Math.round(magnitude(3, 4, 0)), 5);
});

test('téléphone debout : pas de perte de verticalité', () => {
  assert.ok(tiltFromVertical(0, 9.8, 0) < 10);
  assert.equal(isLossOfVerticality(tiltFromVertical(0, 9.8, 0)), false);
  assert.equal(isFlatFromBeta(90), false);
});

test('téléphone à plat : perte de verticalité', () => {
  assert.ok(tiltFromVertical(0, 0, 9.8) > 80);
  assert.equal(isLossOfVerticality(tiltFromVertical(0, 0, 9.8)), true);
  assert.equal(isLossOfVerticality(tiltFromVertical(9.8, 0, 0)), true);
  assert.equal(isFlatFromBeta(0), true);
  assert.equal(isFlatFromBeta(180), true);
});
