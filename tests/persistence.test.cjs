const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const publicDir = resolve(__dirname, '../public');
const html = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
const PREFIX = 'professionelle-zeiterfassung.';
const STORE = PREFIX + 'v2';
const SESSION = PREFIX + 'session';

const tick = () => new Promise(done => setTimeout(done, 20));

async function app(t, seed, fetchImpl) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, { url: 'https://persistence-test.invalid/#overview', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  window.fetch = fetchImpl;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = () => ({ matches: false });
  t.after(() => {
    window.close();
    assert.deepEqual(errors, [], 'The application must not throw during cloud hydration');
  });
  for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, JSON.stringify(value));
  for (const script of window.document.querySelectorAll('script')) {
    const source = script.src ? readFileSync(resolve(publicDir, new URL(script.src).pathname.split('/').pop()), 'utf8') : script.textContent;
    window.eval(source);
  }
  await new Promise(done => window.addEventListener('load', done, { once: true }));
  await tick();
  return window;
}

test('A cleared browser cache hydrates the canonical D1 snapshot before any upload', async t => {
  const requests = [];
  const remoteState = {
    [STORE]: JSON.stringify({ entries: [{ id: 'cloud-entry', date: '2026-09-13', minutes: 60 }], categories: ['Testing'], projects: ['Intern'] }),
    [PREFIX + 'calendar.v1']: JSON.stringify([{ id: 'cloud-event', title: 'Cloud-Termin' }]),
    [PREFIX + 'notes.v1']: JSON.stringify([{ id: 'cloud-note', title: 'Cloud-Notiz' }]),
    [PREFIX + 'sync-complete.v1']: '1'
  };
  const fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    if (String(url).endsWith('/api/auth/me')) return { ok: true, json: async () => ({ user: { id: 'u1', name: 'Valtère', email: 'v@example.ch' } }) };
    if (String(url).endsWith('/api/state') && (options.method || 'GET') === 'GET') return { ok: true, json: async () => ({ exists: true, state: remoteState, version: 7 }) };
    if (String(url).endsWith('/api/state') && options.method === 'PUT') return { ok: true, json: async () => ({ ok: true, version: 8 }) };
    return { ok: false, json: async () => ({ error: 'Unexpected test request' }) };
  };
  const window = await app(t, { [SESSION]: 'test-token' }, fetch);
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORE)).entries.map(entry => entry.id), ['cloud-entry']);
  assert.equal(JSON.parse(window.localStorage.getItem(PREFIX + 'calendar.v1'))[0].id, 'cloud-event');
  assert.equal(JSON.parse(window.localStorage.getItem(PREFIX + 'notes.v1'))[0].id, 'cloud-note');
  assert.equal(requests.filter(request => request.method === 'PUT').length, 0, 'An empty cache must not upload an empty snapshot');
});

test('A legacy D1 profile is promoted to the canonical snapshot on first login', async t => {
  const puts = [];
  const legacyState = { [STORE]: JSON.stringify({ entries: [{ id: 'legacy-entry', date: '2026-09-13', minutes: 45 }] }) };
  const fetch = async (url, options = {}) => {
    if (String(url).endsWith('/api/auth/me')) return { ok: true, json: async () => ({ user: { id: 'u1', name: 'Valtère', email: 'v@example.ch' } }) };
    if (String(url).endsWith('/api/state') && (options.method || 'GET') === 'GET') return { ok: true, json: async () => ({ exists: false, state: legacyState, version: 0 }) };
    if (String(url).endsWith('/api/state') && options.method === 'PUT') {
      puts.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true, version: puts.length }) };
    }
    return { ok: false, json: async () => ({ error: 'Unexpected test request' }) };
  };
  await app(t, { [SESSION]: 'test-token' }, fetch);
  assert.ok(puts.length >= 1);
  assert.ok(puts.every(request => JSON.parse(request.state[STORE]).entries.some(entry => entry.id === 'legacy-entry')));
});

test('Server-side state merge protects stale empty snapshots but allows an explicit current clear', async () => {
  let source = readFileSync(resolve(__dirname, '../worker.js'), 'utf8').replace('export default {', 'globalThis.__workerDefault = {');
  source += '\nglobalThis.__mergeStatePayload = mergeStatePayload;';
  const context = { console, TextEncoder, URL, Response, Headers, crypto: {}, setTimeout, clearTimeout };
  vmRun(source, context);
  const merge = context.__mergeStatePayload;
  const current = {
    [STORE]: JSON.stringify({ entries: [{ id: 'old-entry' }], categories: ['Testing', 'Eigene Kategorie'], projects: ['Intern'], daily: '8h 00' }),
    [PREFIX + 'calendar.v1']: JSON.stringify([{ id: 'old-event' }]),
    [PREFIX + 'notes.v1']: JSON.stringify([{ id: 'old-note' }])
  };
  const staleEmpty = { [PREFIX + 'sync-complete.v1']: '1' };
  assert.deepEqual(merge(current, staleEmpty, { protectEmpty: true }), current);

  const settingChange = { [PREFIX + 'sync-complete.v1']: '1', [STORE]: JSON.stringify({ entries: [], categories: ['Testing'], projects: ['Intern'], daily: '9h 00' }) };
  const protectedUpdate = JSON.parse(merge(current, settingChange, { protectEmpty: true })[STORE]);
  assert.equal(protectedUpdate.entries[0].id, 'old-entry');
  assert.equal(protectedUpdate.daily, '9h 00');
  assert.ok(protectedUpdate.categories.includes('Eigene Kategorie'));

  const explicitClear = { [PREFIX + 'sync-complete.v1']: '1', [STORE]: JSON.stringify({ entries: [], categories: ['Testing'], projects: ['Intern'], daily: '8h 00' }), [PREFIX + 'calendar.v1']: '[]', [PREFIX + 'notes.v1']: '[]' };
  const cleared = merge(current, explicitClear, { protectEmpty: false });
  assert.deepEqual(JSON.parse(cleared[STORE]).entries, []);
  assert.equal(cleared[PREFIX + 'calendar.v1'], '[]');
  assert.equal(cleared[PREFIX + 'notes.v1'], '[]');
});

function vmRun(source, context) {
  const vm = require('node:vm');
  vm.runInNewContext(source, context);
}
