import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScope,
  canAssignRole,
  canRead,
  canWrite,
  escapeHtml,
  presentRecord,
  reportCompanyId,
} from './access.js';

const adminA = { id: 'ua', email: 'admin-a@exemple.test', role: 'admin', companyId: 'co-a' };
const supervisorA = { id: 'us', email: 'sup-a@exemple.test', role: 'supervisor', companyId: 'co-a' };
const agentA = { id: 'uagent', email: 'agent-a@exemple.test', role: 'agent', companyId: 'co-a' };
const clientA = { id: 'uclient', email: 'client-a@exemple.test', role: 'client', companyId: 'co-a' };
const adminB = { id: 'ub', email: 'admin-b@exemple.test', role: 'admin', companyId: 'co-b' };

const agents = [{ id: 'fiche-a', email: 'agent-a@exemple.test', company_id: 'co-a' }];
const clients = [{
  id: 'client-a',
  email: 'client-a@exemple.test',
  company_id: 'co-a',
  portal_perms: { sites_accessibles: ['site-a'] },
}];
const sites = [
  { id: 'site-a', company_id: 'co-a', client_id: 'client-a', agent_ids: ['fiche-a'] },
  { id: 'site-b', company_id: 'co-a', client_id: 'client-b', agent_ids: ['fiche-b'] },
];

function scope(user) {
  return buildScope(user, { agents, clients, sites });
}

test('administrateur A ne lit pas la société B', () => {
  const missionB = { id: 'm-b', company_id: 'co-b', title: 'Vacation B' };
  assert.equal(canRead(adminA, 'Mission', missionB, scope(adminA)), false);
  assert.equal(canRead(adminB, 'Mission', missionB, scope(adminB)), true);
});

test('agent A ne lit pas la fiche ni la paie d\'un autre agent', () => {
  const other = { id: 'fiche-b', email: 'agent-b@exemple.test', company_id: 'co-a' };
  const ownPay = { id: 'pay-a', company_id: 'co-a', agent_id: 'fiche-a' };
  const otherPay = { id: 'pay-b', company_id: 'co-a', agent_id: 'fiche-b' };
  assert.equal(canRead(agentA, 'Agent', other, scope(agentA)), false);
  assert.equal(canRead(agentA, 'Agent', agents[0], scope(agentA)), true);
  assert.equal(canRead(agentA, 'FicheDePaie', ownPay, scope(agentA)), true);
  assert.equal(canRead(agentA, 'FicheDePaie', otherPay, scope(agentA)), false);
});

test('client A ne lit pas un autre client ni une facture étrangère', () => {
  const otherClient = { id: 'client-b', company_id: 'co-a', email: 'autre@exemple.test' };
  const ownInvoice = { id: 'inv-a', company_id: 'co-a', client_id: 'client-a' };
  const otherInvoice = { id: 'inv-b', company_id: 'co-a', client_id: 'client-b' };
  assert.equal(canRead(clientA, 'Client', otherClient, scope(clientA)), false);
  assert.equal(canRead(clientA, 'Client', clients[0], scope(clientA)), true);
  assert.equal(canRead(clientA, 'Invoice', ownInvoice, scope(clientA)), true);
  assert.equal(canRead(clientA, 'Invoice', otherInvoice, scope(clientA)), false);
  assert.equal(canRead(clientA, 'Site', sites[1], scope(clientA)), false);
});

test('une facture ne s\'écrit pas sur une autre société', () => {
  const invoice = { id: 'inv', company_id: 'co-b', client_id: 'client-a' };
  assert.equal(canWrite(adminA, 'Invoice', invoice, 'create', scope(adminA)), false);
});

test('un superviseur ne devient pas administrateur plateforme', () => {
  assert.equal(canAssignRole(supervisorA, 'superadmin'), false);
  assert.equal(canAssignRole(adminA, 'superadmin'), false);
  assert.equal(canAssignRole({ role: 'superadmin' }, 'superadmin'), false);
});

test('un rapport est limité à la société de l\'administrateur', () => {
  assert.equal(reportCompanyId(adminA, 'co-b'), null);
  assert.equal(reportCompanyId(adminA, 'co-a'), 'co-a');
  assert.equal(reportCompanyId(agentA, 'co-a'), null);
  assert.equal(reportCompanyId(null, 'co-a'), null);
});

test('le html d\'un e-mail est échappé et les secrets ne sortent pas', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  const shown = presentRecord(agentA, 'Agent', { id: 'fiche-a', company_id: 'co-a', iban: 'SECRET', email: 'agent-a@exemple.test' });
  assert.equal(shown.iban, undefined);
  assert.equal(shown.email, 'agent-a@exemple.test');
  const site = presentRecord(clientA, 'Site', { id: 'site-a', company_id: 'co-a', cles: '1234' });
  assert.equal(site.cles, undefined);
});

test('un agent ne supprime pas et ne crée pas de facture', () => {
  const own = { id: 'svc', company_id: 'co-a', agent_id: 'fiche-a' };
  assert.equal(canWrite(agentA, 'PriseDeService', own, 'create', scope(agentA)), true);
  assert.equal(canWrite(agentA, 'PriseDeService', own, 'delete', scope(agentA)), false);
  assert.equal(canWrite(agentA, 'Invoice', { id: 'i', company_id: 'co-a', client_id: 'client-a' }, 'create', scope(agentA)), false);
});
