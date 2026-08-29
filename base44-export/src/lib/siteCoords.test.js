import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteLatLng, siteAddress } from './siteCoords.js';

test('siteLatLng ignore les coordonnées vides', () => {
  assert.equal(siteLatLng(null), null);
  assert.equal(siteLatLng({ latitude: 0, longitude: 0 }), null);
  assert.equal(siteLatLng({ latitude: 49.23, longitude: 2.88 }).lat, 49.23);
});

test('siteAddress assemble rue, CP et ville', () => {
  assert.equal(
    siteAddress({ address: '69 Rue Henri Laroche', postal_code: '60800', city: 'Crépy-en-Valois' }),
    '69 Rue Henri Laroche, 60800, Crépy-en-Valois',
  );
});
