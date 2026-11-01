import { test } from 'node:test';
import assert from 'node:assert/strict';
import { establishPhoenixSession } from './phoenixSession.js';

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getToken: () => data.phoenix || data.legacy || null,
    setToken: (token) => {
      data.phoenix = token;
    },
    clearLocalToken: () => {
      delete data.phoenix;
      delete data.legacy;
    },
  };
}

test('un jeton Phoenix valide ouvre la session sans lire le cookie', async () => {
  const store = memoryStore({ phoenix: 'jeton-valide' });
  let sessionCalls = 0;
  const result = await establishPhoenixSession({
    getToken: store.getToken,
    setToken: store.setToken,
    clearLocalToken: store.clearLocalToken,
    me: async () => ({ ok: true, status: 200, user: { email: 'a@exemple.test', role: 'admin' } }),
    fetchSession: async () => {
      sessionCalls += 1;
      return null;
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.user.role, 'admin');
  assert.equal(sessionCalls, 0);
  assert.equal(store.data.phoenix, 'jeton-valide');
});

test('sans jeton local, le cookie Phoenix restaure la session', async () => {
  const store = memoryStore();
  const result = await establishPhoenixSession({
    getToken: store.getToken,
    setToken: store.setToken,
    clearLocalToken: store.clearLocalToken,
    me: async () => ({ ok: true, status: 200, user: { email: 'a@exemple.test' } }),
    fetchSession: async () => 'jeton-cookie',
  });
  assert.equal(result.ok, true);
  assert.equal(store.data.phoenix, 'jeton-cookie');
});

test('un ancien jeton invalide cède la place au cookie Phoenix après un 401', async () => {
  const store = memoryStore({ legacy: 'ancien-jeton-base44' });
  const seen = [];
  const result = await establishPhoenixSession({
    getToken: store.getToken,
    setToken: store.setToken,
    clearLocalToken: store.clearLocalToken,
    me: async () => {
      const current = store.getToken();
      seen.push(current);
      if (current === 'ancien-jeton-base44') return { ok: false, status: 401, user: null };
      return { ok: true, status: 200, user: { email: 'a@exemple.test', role: 'agent' } };
    },
    fetchSession: async () => 'jeton-cookie-phoenix',
  });
  assert.deepEqual(seen, ['ancien-jeton-base44', 'jeton-cookie-phoenix']);
  assert.equal(result.ok, true);
  assert.equal(result.user.role, 'agent');
  assert.equal(store.data.legacy, undefined);
  assert.equal(store.data.phoenix, 'jeton-cookie-phoenix');
});

test('un 401 sans cookie valide laisse la session fermée et retire le jeton local', async () => {
  const store = memoryStore({ phoenix: 'jeton-expire' });
  const result = await establishPhoenixSession({
    getToken: store.getToken,
    setToken: store.setToken,
    clearLocalToken: store.clearLocalToken,
    me: async () => ({ ok: false, status: 401, user: null }),
    fetchSession: async () => null,
  });
  assert.equal(result.ok, false);
  assert.equal(store.data.phoenix, undefined);
});

test('une erreur réseau ne supprime pas le jeton local', async () => {
  const store = memoryStore({ phoenix: 'jeton-valide' });
  let sessionCalls = 0;
  const result = await establishPhoenixSession({
    getToken: store.getToken,
    setToken: store.setToken,
    clearLocalToken: store.clearLocalToken,
    me: async () => ({ ok: false, status: undefined, user: null }),
    fetchSession: async () => {
      sessionCalls += 1;
      return 'autre';
    },
  });
  assert.equal(result.ok, false);
  assert.equal(sessionCalls, 0);
  assert.equal(store.data.phoenix, 'jeton-valide');
});
