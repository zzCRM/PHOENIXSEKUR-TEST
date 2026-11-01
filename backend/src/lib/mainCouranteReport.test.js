import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMainCouranteLines,
  formatCollaborateur,
  formatDateFr,
  parisNow,
  renderMainCourantePdf,
  shortRef,
} from './mainCouranteReport.js';

const prise = {
  id: 'service-TaYkE0my',
  site_id: 'site-1',
  site_name: 'TENNECO',
  client_id: 'client-1',
  client_name: 'FEDERAL MODUL',
  agent_name: 'AGOUNDOU Patrick',
  mission_id: 'mission-1',
  date: '2026-10-18',
  planned_start: '00:00',
  planned_end: '07:30',
  actual_start: '07:04',
  actual_end: '07:34',
  start_latitude: 49.2237,
  start_longitude: 2.907694,
  nfc_validated: true,
};

const execution = {
  id: 'exec-1',
  service_id: prise.id,
  site_id: 'site-1',
  site_name: 'TENNECO',
  agent_name: 'AGOUNDOU Patrick',
  ronde_name: 'RONDE TENNECO',
  date: '2026-10-18',
  start_time: '10:45',
  end_time: '12:05',
  checkpoints_done: [{
    checkpoint_id: 'cp-1',
    checkpoint_name: 'Local serveur',
    time: '10:53',
    nfc_validated: true,
    nfc_serial: '04:A9:B7:C2:3B:6B:80',
    note: 'Température sous 21°',
  }],
};

test('le collaborateur s’affiche NOM Prénom', () => {
  assert.equal(formatCollaborateur('AGOUNDOU Patrick'), 'AGOUNDOU\nPatrick');
  assert.equal(formatCollaborateur('Patrick Agoundou'), 'AGOUNDOU\nPatrick');
});

test('la prise de service, la ronde et le point de contrôle remplissent le rapport', () => {
  const lines = buildMainCouranteLines({
    prises: [prise],
    executions: [execution],
    missions: [{ id: 'mission-1', start_time: '00:00', end_time: '07:30' }],
    start: '2026-10-18',
    end: '2026-10-19',
  });
  const types = lines.map((line) => line.type);
  assert.ok(types.includes('Début de service'));
  assert.ok(types.includes('Fin de service'));
  assert.ok(types.includes('Début de ronde'));
  assert.ok(types.includes('Validation point de contrôle'));
  assert.ok(types.includes('Fin de ronde'));

  const start = lines.find((line) => line.type === 'Début de service');
  assert.equal(start.time, '07:04:00');
  assert.equal(start.date, '2026-10-18');
  assert.equal(start.hours, '00:00 - 07:30');
  assert.match(start.description, /Référence service: TaYkE0my/);
  assert.match(start.description, /Photo de la prise de service/);
  assert.match(start.description, /Badge NFC/);
  assert.match(start.gps, /49\.2237/);
  assert.match(start.collaborateur, /AGOUNDOU/);

  const point = lines.find((line) => line.type === 'Validation point de contrôle');
  assert.match(point.description, /Local serveur/);
  assert.match(point.description, /04:A9:B7:C2:3B:6B:80/);
  assert.match(point.description, /Température sous 21/);
});

test('une saisie manuelle du même pointage ne double pas la ligne', () => {
  const lines = buildMainCouranteLines({
    prises: [prise],
    entries: [{
      id: 'mc-1',
      service_id: prise.id,
      site_id: 'site-1',
      date: '2026-10-18',
      time: '07:04',
      event_type: 'debut_service',
      agent_name: 'AGOUNDOU Patrick',
      content: 'Note libre qui ne doit pas doubler la prise de service',
    }],
    start: '2026-10-18',
    end: '2026-10-18',
  });
  assert.equal(lines.filter((line) => line.type === 'Début de service').length, 1);
  assert.match(lines.find((line) => line.type === 'Début de service').description, /Photo de la prise de service/);
});

test('le PDF reprend le titre, le site et le client', () => {
  const lines = buildMainCouranteLines({
    prises: [prise],
    start: '2026-10-18',
    end: '2026-10-19',
  });
  const pdf = renderMainCourantePdf({
    company: {
      company_name: 'PHOENIX PERSONAL SECURITY FRANCE',
      address: '10 Place Vendôme',
      postal_code: '75001',
      city: 'Paris',
      phone: '06 67 47 72 95',
      email: 'contact@phoenixsekur.com',
      siret: '92899218900011',
      cnaps_number: 'AUT-075-2123-07-31-20240936818',
    },
    sites: [{
      id: 'site-1',
      name: 'TENNECO',
      client_id: 'client-1',
      address: '69 Rue Henri Laroche',
      postal_code: '60800',
      city: 'Crépy-en-Valois',
    }],
    clients: [{ id: 'client-1', company_name: 'FEDERAL MODUL SYSTEMS PROTECTION' }],
    lines,
    start: '2026-10-18',
    end: '2026-10-19',
    editionLabel: '19/10/2026',
    editionTime: '07:00',
    reportNumber: '000327',
  });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const raw = pdf.toString('latin1');
  assert.match(raw, /RAPPORT DE MAIN COURANTE/);
  assert.match(raw, /TENNECO/);
  assert.match(raw, /FEDERAL MODUL SYSTEMS PROTECTION/);
  assert.match(raw, /Début de service/);
  assert.equal(formatDateFr('2026-10-18'), '18/10/2026');
  assert.equal(shortRef('service-TaYkE0my'), 'TaYkE0my');
  assert.equal(typeof parisNow().iso, 'string');
});
