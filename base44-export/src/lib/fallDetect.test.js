import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBrutalFall, tiltFromVertical, magnitude } from './fallDetect.js';

test('magnitude 3 axes', () => {
  assert.equal(Math.round(magnitude(3, 4, 0)), 5);
});

test('poser le téléphone doucement : pas de chute', () => {
  const t0 = 1_000_000;
  const slow = [];
  for (let i = 0; i <= 12; i += 1) {
    slow.push({ t: t0 + i * 120, mag: 9.8, linear: 0.4, tilt: 8 + i * 6 });
  }
  assert.equal(detectBrutalFall(slow), false);
});

test('choc puis à plat : chute brutale', () => {
  const t0 = 1_000_000;
  const hit = [
    { t: t0, mag: 9.8, linear: 0.3, tilt: 12 },
    { t: t0 + 40, mag: 28, linear: 18, tilt: 30 },
    { t: t0 + 80, mag: 9.6, linear: 1.2, tilt: 75 },
    { t: t0 + 160, mag: 9.8, linear: 0.4, tilt: 82 },
    { t: t0 + 240, mag: 9.7, linear: 0.3, tilt: 85 },
  ];
  assert.equal(detectBrutalFall(hit), true);
});

test('bascule soudaine depuis la verticale : chute', () => {
  const t0 = 1_000_000;
  const snap = [
    { t: t0, mag: 9.8, tilt: 10 },
    { t: t0 + 40, mag: 10.2, tilt: 14 },
    { t: t0 + 80, mag: 11, tilt: 28 },
    { t: t0 + 180, mag: 10, tilt: 70 },
    { t: t0 + 260, mag: 9.8, tilt: 80 },
  ];
  assert.equal(detectBrutalFall(snap), true);
});

test('reste debout : pas de chute', () => {
  const t0 = 1_000_000;
  const up = Array.from({ length: 8 }, (_, i) => ({ t: t0 + i * 50, mag: 9.8, linear: 0.2, tilt: 12 }));
  assert.equal(detectBrutalFall(up), false);
});

test('téléphone déjà à plat sans choc : pas de chute', () => {
  assert.ok(tiltFromVertical(0, 0, 9.8) > 80);
  const t0 = 1_000_000;
  const flat = Array.from({ length: 8 }, (_, i) => ({ t: t0 + i * 50, mag: 9.8, linear: 0.2, tilt: 85 }));
  assert.equal(detectBrutalFall(flat), false);
});
